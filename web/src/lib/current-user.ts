import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, UserRole } from "@/lib/types";

// Fetches the signed-in user's profile row. Middleware already guarantees
// a session exists on protected routes, but we still redirect defensively
// in case this is called somewhere middleware doesn't cover.
export async function requireUser(role?: UserRole): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: AppUser;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (role && profile.role !== role) redirect(`/${profile.role}`);

  return { supabase, profile: profile as AppUser };
}
