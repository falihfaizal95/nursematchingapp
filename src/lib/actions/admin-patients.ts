"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";

export async function createPatient(formData: FormData) {
  const { supabase, profile } = await requireUser("admin");

  const payload = {
    agency_id: profile.agency_id,
    full_name: String(formData.get("full_name") || ""),
    date_of_birth: (formData.get("date_of_birth") as string) || null,
    address: String(formData.get("address") || ""),
    lat: Number(formData.get("lat")),
    lng: Number(formData.get("lng")),
    primary_condition: (formData.get("primary_condition") as string) || null,
    allergies: (formData.get("allergies") as string) || null,
    emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
    emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };

  const { data, error } = await supabase.from("patients").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "create",
    entityType: "patient",
    entityId: data.id,
  });

  revalidatePath("/admin/patients");
  return data.id as string;
}

export async function updatePatient(patientId: string, formData: FormData) {
  const { supabase, profile } = await requireUser("admin");

  const payload = {
    full_name: String(formData.get("full_name") || ""),
    date_of_birth: (formData.get("date_of_birth") as string) || null,
    address: String(formData.get("address") || ""),
    lat: Number(formData.get("lat")),
    lng: Number(formData.get("lng")),
    primary_condition: (formData.get("primary_condition") as string) || null,
    allergies: (formData.get("allergies") as string) || null,
    emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
    emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
    notes: (formData.get("notes") as string) || null,
    active: formData.get("active") === "on",
  };

  const { error } = await supabase.from("patients").update(payload).eq("id", patientId);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "update",
    entityType: "patient",
    entityId: patientId,
  });

  revalidatePath("/admin/patients");
  revalidatePath(`/admin/patients/${patientId}`);
}

export async function createCarePlan(patientId: string, title: string) {
  const { supabase, profile } = await requireUser("admin");

  const { data, error } = await supabase
    .from("care_plans")
    .insert({ agency_id: profile.agency_id, patient_id: patientId, title })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/patients/${patientId}`);
  return data.id as string;
}

export async function addCareTask(
  carePlanId: string,
  patientId: string,
  formData: FormData,
) {
  const { supabase } = await requireUser("admin");

  const { error } = await supabase.from("care_tasks").insert({
    care_plan_id: carePlanId,
    label: String(formData.get("label") || ""),
    category: String(formData.get("category") || "other"),
    instructions: (formData.get("instructions") as string) || null,
    sort_order: Number(formData.get("sort_order") || 0),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/patients/${patientId}`);
}

export async function deleteCareTask(taskId: string, patientId: string) {
  const { supabase } = await requireUser("admin");
  const { error } = await supabase.from("care_tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/patients/${patientId}`);
}
