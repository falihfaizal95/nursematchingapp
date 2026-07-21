"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";
import { distanceMeters, CHECK_IN_RADIUS_M } from "@/lib/geo";
import { CARE_TASKS, type CareTaskField, type Mood } from "@/lib/types";

const TASK_FIELDS = new Set<string>(CARE_TASKS.map((t) => t.field));

async function ownedVisit(visitId: string) {
  const { supabase, profile } = await requireUser("caregiver");
  const { data: visit, error } = await supabase
    .from("visits")
    .select("id, agency_id, patient_id, caregiver_id")
    .eq("id", visitId)
    .eq("caregiver_id", profile.id)
    .single();
  if (error || !visit) throw new Error("Visit not found.");
  return { supabase, profile, visit };
}

export async function clockIn(patientId: string, lat: number, lng: number): Promise<string> {
  const { supabase, profile } = await requireUser("caregiver");

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, lat, lng, caregiver_id, agency_id")
    .eq("id", patientId)
    .single();
  if (patientError || !patient || patient.caregiver_id !== profile.id) {
    throw new Error("You're not assigned to this patient.");
  }

  const distance = distanceMeters(lat, lng, patient.lat, patient.lng);
  const flagged = distance > CHECK_IN_RADIUS_M;

  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      agency_id: patient.agency_id,
      patient_id: patientId,
      caregiver_id: profile.id,
      clock_in_lat: lat,
      clock_in_lng: lng,
      clock_in_flagged: flagged,
      clock_in_distance_m: distance,
      current_lat: lat,
      current_lng: lng,
      location_updated_at: new Date().toISOString(),
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("patient_updates").insert({
    agency_id: patient.agency_id,
    patient_id: patientId,
    visit_id: visit.id,
    author_id: profile.id,
    type: "arrived",
    body: "Caregiver arrived",
  });

  await recordAudit(supabase, {
    agencyId: patient.agency_id,
    userId: profile.id,
    action: "clock_in",
    entityType: "visit",
    entityId: visit.id,
    metadata: { flagged, distance_m: distance },
  });

  revalidatePath("/caregiver");
  return visit.id as string;
}

// Toggle one care-checklist item. When turned on it also drops a timestamped
// entry on the family's timeline; turning it off removes that entry.
export async function toggleTask(visitId: string, field: string, label: string, on: boolean) {
  if (!TASK_FIELDS.has(field)) throw new Error("Unknown task.");
  const { supabase, profile, visit } = await ownedVisit(visitId);

  const { error } = await supabase
    .from("visits")
    .update({ [field as CareTaskField]: on })
    .eq("id", visitId);
  if (error) throw new Error(error.message);

  if (on) {
    await supabase.from("patient_updates").insert({
      agency_id: visit.agency_id,
      patient_id: visit.patient_id,
      visit_id: visitId,
      author_id: profile.id,
      type: "task",
      body: label,
    });
  } else {
    await supabase
      .from("patient_updates")
      .delete()
      .eq("visit_id", visitId)
      .eq("type", "task")
      .eq("body", label);
  }

  revalidatePath("/family");
}

export async function setMood(visitId: string, mood: Mood) {
  const { supabase } = await ownedVisit(visitId);
  const { error } = await supabase.from("visits").update({ mood }).eq("id", visitId);
  if (error) throw new Error(error.message);
  revalidatePath("/family");
}

export async function setPain(visitId: string, pain: number | null) {
  const { supabase } = await ownedVisit(visitId);
  const { error } = await supabase.from("visits").update({ pain_level: pain }).eq("id", visitId);
  if (error) throw new Error(error.message);
  revalidatePath("/family");
}

export async function saveNote(visitId: string, note: string) {
  const { supabase } = await ownedVisit(visitId);
  const { error } = await supabase.from("visits").update({ report: note }).eq("id", visitId);
  if (error) throw new Error(error.message);
  revalidatePath("/family");
}

export async function flagConcern(visitId: string, text: string) {
  const { supabase, profile, visit } = await ownedVisit(visitId);
  const body = text.trim();
  if (!body) throw new Error("Describe the concern first.");

  const { error } = await supabase
    .from("visits")
    .update({ concern_flag: true, concern_text: body })
    .eq("id", visitId);
  if (error) throw new Error(error.message);

  await supabase.from("patient_updates").insert({
    agency_id: visit.agency_id,
    patient_id: visit.patient_id,
    visit_id: visitId,
    author_id: profile.id,
    type: "concern",
    body,
  });

  await recordAudit(supabase, {
    agencyId: visit.agency_id,
    userId: profile.id,
    action: "flag_concern",
    entityType: "visit",
    entityId: visitId,
  });

  revalidatePath("/family");
  revalidatePath("/admin");
}

export async function clockOut(visitId: string, lat: number, lng: number) {
  const { supabase, profile, visit } = await ownedVisit(visitId);

  const { data: full } = await supabase.from("visits").select("report").eq("id", visitId).single();

  const { error } = await supabase
    .from("visits")
    .update({
      clock_out_at: new Date().toISOString(),
      clock_out_lat: lat,
      clock_out_lng: lng,
      current_lat: null,
      current_lng: null,
      location_updated_at: null,
      status: "completed",
    })
    .eq("id", visitId);
  if (error) throw new Error(error.message);

  // The written note shows in the family timeline as the day's update.
  if (full?.report?.trim()) {
    await supabase.from("patient_updates").insert({
      agency_id: visit.agency_id,
      patient_id: visit.patient_id,
      visit_id: visitId,
      author_id: profile.id,
      type: "shift_report",
      body: full.report.trim(),
    });
  }

  await supabase.from("patient_updates").insert({
    agency_id: visit.agency_id,
    patient_id: visit.patient_id,
    visit_id: visitId,
    author_id: profile.id,
    type: "completed",
    body: "Shift complete",
  });

  await recordAudit(supabase, {
    agencyId: visit.agency_id,
    userId: profile.id,
    action: "clock_out",
    entityType: "visit",
    entityId: visitId,
  });

  revalidatePath("/caregiver");
  revalidatePath("/family");
}
