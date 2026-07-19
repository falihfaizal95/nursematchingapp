import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Patient } from "@/lib/types";

export async function getLinkedPatients(supabase: SupabaseClient, familyUserId: string) {
  const { data } = await supabase
    .from("family_links")
    .select("patients(*)")
    .eq("family_user_id", familyUserId);

  return (data ?? [])
    .map((l) => (l as unknown as { patients: Patient }).patients)
    .filter(Boolean);
}

export async function getSelectedPatient(
  supabase: SupabaseClient,
  familyUserId: string,
  requestedId?: string,
): Promise<Patient> {
  const patients = await getLinkedPatients(supabase, familyUserId);
  if (patients.length === 0) redirect("/login");

  const selected = requestedId ? patients.find((p) => p.id === requestedId) : undefined;
  return selected ?? patients[0];
}
