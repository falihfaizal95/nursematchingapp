"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit";

export async function createPatient(formData: FormData): Promise<string> {
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

export async function assignCaregiver(patientId: string, caregiverId: string | null) {
  const { supabase, profile } = await requireUser("admin");

  const { error } = await supabase
    .from("patients")
    .update({ caregiver_id: caregiverId })
    .eq("id", patientId)
    .eq("agency_id", profile.agency_id);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "assign_caregiver",
    entityType: "patient",
    entityId: patientId,
    metadata: { caregiver_id: caregiverId },
  });

  revalidatePath(`/admin/patients/${patientId}`);
}

async function inviteUser(
  role: "caregiver" | "family",
  agencyId: string,
  fullName: string,
  email: string,
  phone: string | null,
) {
  const admin = createAdminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
  });
  if (inviteError || !invited.user) {
    throw new Error(inviteError?.message || "Failed to invite user");
  }

  const { error: profileError } = await admin.from("users").insert({
    id: invited.user.id,
    agency_id: agencyId,
    role,
    full_name: fullName,
    email,
    phone,
  });
  if (profileError) throw new Error(profileError.message);

  return invited.user.id as string;
}

export async function inviteCaregiver(formData: FormData) {
  const { supabase, profile } = await requireUser("admin");

  const userId = await inviteUser(
    "caregiver",
    profile.agency_id,
    String(formData.get("full_name") || ""),
    String(formData.get("email") || ""),
    (formData.get("phone") as string) || null,
  );

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "invite",
    entityType: "caregiver",
    entityId: userId,
  });

  revalidatePath("/admin/caregivers");
}

export async function inviteFamily(patientId: string, formData: FormData) {
  const { supabase, profile } = await requireUser("admin");

  const userId = await inviteUser(
    "family",
    profile.agency_id,
    String(formData.get("full_name") || ""),
    String(formData.get("email") || ""),
    (formData.get("phone") as string) || null,
  );

  const { error } = await supabase.from("family_links").insert({
    patient_id: patientId,
    family_user_id: userId,
    relationship: (formData.get("relationship") as string) || null,
  });
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "invite",
    entityType: "family_member",
    entityId: userId,
    metadata: { patient_id: patientId },
  });

  revalidatePath(`/admin/patients/${patientId}`);
}
