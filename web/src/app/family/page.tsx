import { requireUser } from "@/lib/current-user";
import { getSelectedPatient } from "@/lib/family-patient";
import { FamilyDashboard } from "./_components/family-dashboard";
import type { AppUser, Agency, PatientUpdate, Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { supabase, profile } = await requireUser("family");
  const { patient: patientParam } = await searchParams;
  const patient = await getSelectedPatient(supabase, profile.id, patientParam);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [{ data: caregiver }, { data: agency }, { data: activeVisit }, { data: todayVisit }, { data: updates }] =
    await Promise.all([
      patient.caregiver_id
        ? supabase.from("users").select("*").eq("id", patient.caregiver_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("agencies").select("*").eq("id", patient.agency_id).single(),
      supabase
        .from("visits")
        .select("*")
        .eq("patient_id", patient.id)
        .eq("status", "active")
        .order("clock_in_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("visits")
        .select("*")
        .eq("patient_id", patient.id)
        .gte("clock_in_at", startOfToday.toISOString())
        .order("clock_in_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("patient_updates")
        .select("*, users(full_name, role)")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

  return (
    <FamilyDashboard
      patient={patient}
      caregiver={(caregiver as AppUser) ?? null}
      agency={agency as Agency}
      activeVisit={(activeVisit as Visit) ?? null}
      todayVisit={(todayVisit as Visit) ?? null}
      updates={(updates ?? []) as (PatientUpdate & { users: { full_name: string; role: string } })[]}
      profile={profile}
    />
  );
}
