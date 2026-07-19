import { requireUser } from "@/lib/current-user";
import { getSelectedPatient } from "@/lib/family-patient";
import { FamilyDashboard } from "./_components/family-dashboard";
import type { AppUser, PatientUpdate, Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { supabase, profile } = await requireUser("family");
  const { patient: patientParam } = await searchParams;
  const patient = await getSelectedPatient(supabase, profile.id, patientParam);

  const [{ data: caregiver }, { data: activeVisit }, { data: updates }] = await Promise.all([
    patient.caregiver_id
      ? supabase.from("users").select("*").eq("id", patient.caregiver_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("visits")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("patient_updates")
      .select("*, users(full_name, role)")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <FamilyDashboard
      patient={patient}
      caregiver={(caregiver as AppUser) ?? null}
      activeVisit={(activeVisit as Visit) ?? null}
      updates={(updates ?? []) as (PatientUpdate & { users: { full_name: string; role: string } })[]}
      profile={profile}
    />
  );
}
