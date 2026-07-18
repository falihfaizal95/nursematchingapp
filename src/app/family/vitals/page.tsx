import { requireUser } from "@/lib/current-user";
import { getSelectedPatient } from "@/lib/family";
import { VitalsCharts } from "./_components/vitals-charts";
import type { Vitals } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VitalsPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { supabase, profile } = await requireUser("family");
  const { patient: patientParam } = await searchParams;
  const patient = await getSelectedPatient(supabase, profile.id, patientParam);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const { data: vitals } = await supabase
    .from("vitals")
    .select("*")
    .eq("patient_id", patient.id)
    .gte("recorded_at", sixtyDaysAgo.toISOString())
    .order("recorded_at");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Vitals trends</h1>
        <p className="text-sm text-stone-500">Last 60 days for {patient.full_name}</p>
      </div>
      <VitalsCharts vitals={(vitals ?? []) as Vitals[]} />
    </div>
  );
}
