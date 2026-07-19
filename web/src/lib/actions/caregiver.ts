"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";
import { distanceMeters, CHECK_IN_RADIUS_M } from "@/lib/geo";

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

export async function submitReportAndClockOut(
  visitId: string,
  report: string,
  lat: number,
  lng: number,
) {
  const { supabase, profile } = await requireUser("caregiver");

  if (!report.trim()) throw new Error("An end-of-day report is required before you can clock out.");

  const { data: visit, error } = await supabase
    .from("visits")
    .update({
      report: report.trim(),
      clock_out_at: new Date().toISOString(),
      clock_out_lat: lat,
      clock_out_lng: lng,
      current_lat: null,
      current_lng: null,
      location_updated_at: null,
      status: "completed",
    })
    .eq("id", visitId)
    .eq("caregiver_id", profile.id)
    .select("agency_id, patient_id")
    .single();
  if (error) throw new Error(error.message);

  const { error: updateError } = await supabase.from("patient_updates").insert({
    agency_id: visit.agency_id,
    patient_id: visit.patient_id,
    visit_id: visitId,
    author_id: profile.id,
    type: "shift_report",
    body: report.trim(),
  });
  if (updateError) throw new Error(updateError.message);

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
