import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { distanceMeters, CHECK_IN_RADIUS_M } from "@/lib/geo";

async function currentPosition() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission is required.");
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

async function requireProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!profile) throw new Error("No profile found");
  return profile as { id: string; agency_id: string; role: string };
}

export async function checkIn(shiftId: string): Promise<string> {
  const profile = await requireProfile();
  const { lat, lng } = await currentPosition();

  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("id, patient_id, agency_id")
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

  return visit.id as string;
}

export async function toggleVisitTask(visitTaskId: string, completed: boolean) {
  const { error } = await supabase
    .from("visit_tasks")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", visitTaskId);
  if (error) throw new Error(error.message);
}

export async function saveVitals(
  visitId: string,
  patientId: string,
  vitals: {
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    heart_rate?: number | null;
    glucose?: number | null;
    temperature?: number | null;
    pain_level?: number | null;
    mood?: string | null;
  },
) {
  const { error } = await supabase.from("vitals").insert({
    visit_id: visitId,
    patient_id: patientId,
    ...vitals,
  });
  if (error) throw new Error(error.message);
}

export async function saveVisitNote(visitId: string, summary: string, body: string | null) {
  const { error } = await supabase
    .from("visit_notes")
    .upsert({ visit_id: visitId, summary, body }, { onConflict: "visit_id" });
  if (error) throw new Error(error.message);
}

export async function checkOut(visitId: string): Promise<void> {
  const profile = await requireProfile();
  const { lat, lng } = await currentPosition();

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
}

export async function createIncident(params: {
  patient_id: string;
  visit_id?: string | null;
  type: string;
  severity: string;
  description: string;
}) {
  const profile = await requireProfile();

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      agency_id: profile.agency_id,
      patient_id: params.patient_id,
      nurse_id: profile.id,
      visit_id: params.visit_id ?? null,
      type: params.type,
      severity: params.severity,
      description: params.description,
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

  return data.id as string;
}
