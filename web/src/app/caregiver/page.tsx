import { requireUser } from "@/lib/current-user";
import { CaregiverDashboard } from "./_components/caregiver-dashboard";
import type { Patient, Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CaregiverPage() {
  const { supabase, profile } = await requireUser("caregiver");

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("caregiver_id", profile.id)
    .maybeSingle();

  let activeVisit: Visit | null = null;
  if (patient) {
    const { data } = await supabase
      .from("visits")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("caregiver_id", profile.id)
      .eq("status", "active")
      .maybeSingle();
    activeVisit = (data as Visit) ?? null;
  }

  return <CaregiverDashboard patient={(patient as Patient) ?? null} initialVisit={activeVisit} />;
}
