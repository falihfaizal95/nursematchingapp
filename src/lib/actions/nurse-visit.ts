"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";
import { distanceMeters, CHECK_IN_RADIUS_M } from "@/lib/geo";

export async function checkIn(shiftId: string, lat: number, lng: number) {
  const { supabase, profile } = await requireUser("nurse");

  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("id, patient_id, agency_id, status")
    .eq("id", shiftId)
    .single();
  if (shiftError || !shift) throw new Error("Shift not found");

  const { data: patient } = await supabase
    .from("patients")
    .select("lat, lng")
    .eq("id", shift.patient_id)
    .single();

  const distance = patient ? distanceMeters(lat, lng, patient.lat, patient.lng) : null;
  const flagged = distance !== null && distance > CHECK_IN_RADIUS_M;

  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      agency_id: shift.agency_id,
      shift_id: shiftId,
      patient_id: shift.patient_id,
      nurse_id: profile.id,
      check_in_at: new Date().toISOString(),
      check_in_lat: lat,
      check_in_lng: lng,
      check_in_flagged: flagged,
      check_in_distance_m: distance,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("shifts").update({ status: "checked_in" }).eq("id", shiftId);

  // Seed visit_tasks from the patient's active care plan(s).
  const { data: plans } = await supabase
    .from("care_plans")
    .select("id")
    .eq("patient_id", shift.patient_id)
    .eq("active", true);

  if (plans?.length) {
    const { data: tasks } = await supabase
      .from("care_tasks")
      .select("id")
      .in("care_plan_id", plans.map((p) => p.id));

    if (tasks?.length) {
      await supabase.from("visit_tasks").insert(
        tasks.map((t) => ({ visit_id: visit.id, care_task_id: t.id })),
      );
    }
  }

  await recordAudit(supabase, {
    agencyId: shift.agency_id,
    userId: profile.id,
    action: "check_in",
    entityType: "visit",
    entityId: visit.id,
    metadata: { flagged, distance_m: distance },
  });

  revalidatePath("/nurse");
  return visit.id as string;
}

export async function toggleVisitTask(visitTaskId: string, completed: boolean, visitId: string) {
  const { supabase } = await requireUser("nurse");
  const { error } = await supabase
    .from("visit_tasks")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", visitTaskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/nurse/visits/${visitId}`);
}

export async function saveVitals(visitId: string, patientId: string, formData: FormData) {
  const { supabase } = await requireUser("nurse");

  const num = (key: string) => {
    const v = formData.get(key);
    return v === null || v === "" ? null : Number(v);
  };

  const { error } = await supabase.from("vitals").insert({
    visit_id: visitId,
    patient_id: patientId,
    bp_systolic: num("bp_systolic"),
    bp_diastolic: num("bp_diastolic"),
    heart_rate: num("heart_rate"),
    glucose: num("glucose"),
    temperature: num("temperature"),
    pain_level: num("pain_level"),
    mood: (formData.get("mood") as string) || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/nurse/visits/${visitId}`);
}

export async function saveVisitNote(visitId: string, formData: FormData) {
  const { supabase } = await requireUser("nurse");

  const { error } = await supabase.from("visit_notes").upsert(
    {
      visit_id: visitId,
      summary: String(formData.get("summary") || ""),
      body: (formData.get("body") as string) || null,
    },
    { onConflict: "visit_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/nurse/visits/${visitId}`);
}

export async function checkOut(visitId: string, lat: number, lng: number) {
  const { supabase, profile } = await requireUser("nurse");

  const { data: visit, error } = await supabase
    .from("visits")
    .update({
      check_out_at: new Date().toISOString(),
      check_out_lat: lat,
      check_out_lng: lng,
      status: "completed",
    })
    .eq("id", visitId)
    .select("shift_id, agency_id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("shifts").update({ status: "completed" }).eq("id", visit.shift_id);

  await recordAudit(supabase, {
    agencyId: visit.agency_id,
    userId: profile.id,
    action: "check_out",
    entityType: "visit",
    entityId: visitId,
  });

  revalidatePath("/nurse");
}

export async function createIncident(formData: FormData) {
  const { supabase, profile } = await requireUser("nurse");

  const patientId = String(formData.get("patient_id") || "");
  const visitId = (formData.get("visit_id") as string) || null;

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      agency_id: profile.agency_id,
      patient_id: patientId,
      nurse_id: profile.id,
      visit_id: visitId,
      type: String(formData.get("type") || "other"),
      severity: String(formData.get("severity") || "medium"),
      description: String(formData.get("description") || ""),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "create",
    entityType: "incident",
    entityId: data.id,
  });

  revalidatePath("/nurse");
  revalidatePath("/admin/incidents");
  return data.id as string;
}
