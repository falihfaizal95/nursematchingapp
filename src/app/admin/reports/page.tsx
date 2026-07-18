import { requireUser } from "@/lib/current-user";
import { startOfWeek, format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { supabase, profile } = await requireUser("admin");

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const { data: visits } = await supabase
    .from("visits")
    .select("check_in_at, check_out_at, patients(full_name), users!visits_nurse_id_fkey(full_name)")
    .eq("agency_id", profile.agency_id)
    .eq("status", "completed")
    .gte("check_in_at", eightWeeksAgo.toISOString());

  type Row = { check_in_at: string; check_out_at: string; patients: { full_name: string }; users: { full_name: string } };
  const rows = (visits ?? []) as unknown as Row[];

  const byWeekPatient = new Map<string, Map<string, number>>();
  const byWeekNurse = new Map<string, Map<string, number>>();

  for (const v of rows) {
    if (!v.check_in_at || !v.check_out_at) continue;
    const hours = (new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 3_600_000;
    const week = format(startOfWeek(new Date(v.check_in_at)), "MMM d");

    const patientMap = byWeekPatient.get(week) ?? new Map();
    patientMap.set(v.patients?.full_name ?? "Unknown", (patientMap.get(v.patients?.full_name ?? "Unknown") ?? 0) + hours);
    byWeekPatient.set(week, patientMap);

    const nurseMap = byWeekNurse.get(week) ?? new Map();
    nurseMap.set(v.users?.full_name ?? "Unknown", (nurseMap.get(v.users?.full_name ?? "Unknown") ?? 0) + hours);
    byWeekNurse.set(week, nurseMap);
  }

  const weeks = Array.from(byWeekPatient.keys()).sort();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Reports</h1>
        <p className="text-sm text-stone-500">Hours delivered per week — the basis for billing and payroll.</p>
      </div>

      <ReportTable title="Hours per patient" weeks={weeks} data={byWeekPatient} />
      <ReportTable title="Hours per nurse" weeks={weeks} data={byWeekNurse} />
    </div>
  );
}

function ReportTable({
  title,
  weeks,
  data,
}: {
  title: string;
  weeks: string[];
  data: Map<string, Map<string, number>>;
}) {
  const names = new Set<string>();
  data.forEach((m) => m.forEach((_v, name) => names.add(name)));

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Week of</th>
              {Array.from(names).map((n) => (
                <th key={n} className="px-4 py-3">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w} className="border-t border-stone-100">
                <td className="px-4 py-3 font-medium text-stone-900">{w}</td>
                {Array.from(names).map((n) => (
                  <td key={n} className="px-4 py-3 text-stone-600">
                    {(data.get(w)?.get(n) ?? 0).toFixed(1)}h
                  </td>
                ))}
              </tr>
            ))}
            {weeks.length === 0 && (
              <tr>
                <td colSpan={names.size + 1} className="px-4 py-8 text-center text-stone-400">
                  No completed visits in the last 8 weeks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
