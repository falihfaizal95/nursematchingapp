import { supabase } from "@/lib/supabase";

export async function inviteUser(params: {
  role: "nurse" | "family";
  full_name: string;
  email: string;
  phone?: string;
  patient_id?: string;
  relationship?: string;
}) {
  const { data, error } = await supabase.functions.invoke<{
    userId: string;
    email: string;
    tempPassword: string;
  }>("invite-user", { body: params });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("No response from invite-user function");
  return data;
}
