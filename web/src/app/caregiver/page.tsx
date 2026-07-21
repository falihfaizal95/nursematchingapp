import { requireUser } from "@/lib/current-user";
import { CaregiverDashboard } from "./_components/caregiver-dashboard";
import type { AppUser, Patient, Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CaregiverPage() {
  const { supabase, profile } = await requireUser("caregiver");

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("caregiver_id", profile.id)
    .maybeSingle();

  let todayVisit: Visit | null = null;
  if (patient) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("visits")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("caregiver_id", profile.id)
      .gte("clock_in_at", start.toISOString())
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    todayVisit = (data as Visit) ?? null;
  }

  return (
    <CaregiverDashboard
      patient={(patient as Patient) ?? null}
      initialVisit={todayVisit}
      caregiver={profile as AppUser}
    />
  );
}
