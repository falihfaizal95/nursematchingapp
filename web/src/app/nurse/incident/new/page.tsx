import { redirect } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createIncident } from "@/lib/actions/nurse-visit";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage({
  searchParams,
}: {
  searchParams: Promise<{ visit_id?: string }>;
}) {
  const { supabase, profile } = await requireUser("nurse");
  const { visit_id } = await searchParams;

  const { data: shifts } = await supabase
    .from("shifts")
    .select("patient_id, patients(full_name)")
    .eq("nurse_id", profile.id)
    .order("start_time", { ascending: false })
    .limit(50);

  const patientMap = new Map<string, string>();
  for (const s of shifts ?? []) {
    const p = (s as unknown as { patient_id: string; patients: { full_name: string } }).patients;
    patientMap.set((s as unknown as { patient_id: string }).patient_id, p?.full_name);
  }

  async function action(formData: FormData) {
    "use server";
    await createIncident(formData);
    redirect("/nurse");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Report an incident</h1>
        <p className="text-sm text-stone-500">This immediately flags the agency for review.</p>
      </div>

      <form action={action} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
        {visit_id && <input type="hidden" name="visit_id" value={visit_id} />}
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Patient</label>
          <select name="patient_id" required className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
            {Array.from(patientMap.entries()).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Type</label>
          <select name="type" required className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
            <option value="fall">Fall</option>
            <option value="refusal">Care refusal</option>
            <option value="medication_error">Medication error</option>
            <option value="concern">General concern</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Severity</label>
          <select name="severity" required defaultValue="medium" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">What happened</label>
          <textarea name="description" required rows={5} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white active:bg-red-700">
          Submit report
        </button>
      </form>
    </div>
  );
}
