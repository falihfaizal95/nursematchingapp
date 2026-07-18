import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import {
  createCarePlan,
  addCareTask,
  deleteCareTask,
} from "@/lib/actions/admin-patients";
import { inviteFamily } from "@/lib/actions/admin-people";
import { Trash2 } from "lucide-react";
import type { CarePlan, CareTask, FamilyLink, AppUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireUser("admin");

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("agency_id", profile.agency_id)
    .single();
  if (!patient) notFound();

  const [{ data: carePlans }, { data: familyLinks }, { data: recentVisits }] = await Promise.all([
    supabase
      .from("care_plans")
      .select("*, care_tasks(*)")
      .eq("patient_id", id)
      .order("created_at"),
    supabase.from("family_links").select("*, users(*)").eq("patient_id", id),
    supabase
      .from("visits")
      .select("*, users!visits_nurse_id_fkey(full_name), visit_notes(summary)")
      .eq("patient_id", id)
      .order("check_in_at", { ascending: false })
      .limit(5),
  ]);

  type PlanRow = CarePlan & { care_tasks: CareTask[] };
  const plans = (carePlans ?? []) as unknown as PlanRow[];
  type LinkRow = FamilyLink & { users: AppUser };
  const links = (familyLinks ?? []) as unknown as LinkRow[];

  async function addPlanAction(formData: FormData) {
    "use server";
    await createCarePlan(id, String(formData.get("title") || "Care plan"));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{patient.full_name}</h1>
        <p className="text-sm text-stone-500">{patient.address}</p>
      </div>

      <section className="grid gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <Info label="Date of birth" value={patient.date_of_birth} />
        <Info label="Primary condition" value={patient.primary_condition} />
        <Info label="Allergies" value={patient.allergies} />
        <Info
          label="Emergency contact"
          value={
            patient.emergency_contact_name
              ? `${patient.emergency_contact_name} — ${patient.emergency_contact_phone ?? ""}`
              : null
          }
        />
        {patient.notes && (
          <div className="sm:col-span-2">
            <Info label="Notes" value={patient.notes} />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">Care plans</h2>
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="font-medium text-stone-900">{plan.title}</h3>
            <ul className="mt-3 divide-y divide-stone-100">
              {plan.care_tasks
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((task) => (
                  <li key={task.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-medium text-stone-800">{task.label}</span>{" "}
                      <span className="text-xs uppercase tracking-wide text-stone-400">{task.category}</span>
                      {task.instructions && <p className="text-xs text-stone-500">{task.instructions}</p>}
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await deleteCareTask(task.id, id);
                      }}
                    >
                      <button className="text-stone-300 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </li>
                ))}
              {plan.care_tasks.length === 0 && (
                <li className="py-2 text-sm text-stone-400">No tasks yet.</li>
              )}
            </ul>

            <form
              action={async (formData: FormData) => {
                "use server";
                await addCareTask(plan.id, id, formData);
              }}
              className="mt-4 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4"
            >
              <input
                name="label"
                placeholder="Task label (e.g. Give morning meds)"
                required
                className="min-w-[220px] flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
              />
              <select name="category" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
                <option value="medication">Medication</option>
                <option value="wound_care">Wound care</option>
                <option value="bathing">Bathing</option>
                <option value="meals">Meals</option>
                <option value="mobility">Mobility</option>
                <option value="vitals">Vitals</option>
                <option value="other">Other</option>
              </select>
              <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700">
                Add task
              </button>
            </form>
          </div>
        ))}

        <form action={addPlanAction} className="flex items-end gap-2 rounded-xl border border-dashed border-stone-300 p-4">
          <input
            name="title"
            placeholder="New care plan title (e.g. Daily Care Plan)"
            required
            className="min-w-[220px] flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700">
            Add care plan
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">Family access</h2>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <ul className="divide-y divide-stone-100">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-stone-800">{link.users?.full_name}</span>
                <span className="text-stone-500">
                  {link.users?.email} {link.relationship ? `· ${link.relationship}` : ""}
                </span>
              </li>
            ))}
            {links.length === 0 && <li className="py-2 text-sm text-stone-400">No family invited yet.</li>}
          </ul>

          <form
            action={async (formData: FormData) => {
              "use server";
              await inviteFamily(id, formData);
            }}
            className="mt-4 grid grid-cols-1 gap-2 border-t border-stone-100 pt-4 sm:grid-cols-4"
          >
            <input name="full_name" placeholder="Full name" required className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" />
            <input name="email" type="email" placeholder="Email" required className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" />
            <input name="relationship" placeholder="Relationship (e.g. Daughter)" className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" />
            <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700">
              Send invite
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">Recent visits</h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Nurse</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody>
              {(recentVisits ?? []).map((v) => (
                <tr key={v.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-stone-600">
                    {v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(v as unknown as { users: { full_name: string } }).users?.full_name}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {(v as unknown as { visit_notes: { summary: string }[] }).visit_notes?.[0]?.summary || "—"}
                  </td>
                </tr>
              ))}
              {(recentVisits ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-stone-400">
                    No visits yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="text-sm text-stone-800">{value || "—"}</p>
    </div>
  );
}
