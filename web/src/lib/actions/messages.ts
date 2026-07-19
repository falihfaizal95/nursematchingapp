"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(patientId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("users")
    .select("agency_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");

  const body = String(formData.get("body") || "").trim();
  if (!body) return;

  const { error } = await supabase.from("messages").insert({
    agency_id: profile.agency_id,
    patient_id: patientId,
    sender_id: user.id,
    body,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/family/messages`);
  revalidatePath(`/admin/patients/${patientId}`);
}
