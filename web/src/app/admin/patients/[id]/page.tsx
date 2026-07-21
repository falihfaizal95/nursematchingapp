import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { assignCaregiver } from "@/lib/actions/admin";
import { inviteFamily } from "@/lib/actions/admin";
import { NextVisitEditor } from "@/app/admin/_components/next-visit-editor";
import type { AppUser, FamilyLink } from "@/lib/types";

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

  const [{ data: caregivers }, { data: familyLinks }, { data: recentUpdates }] = await Promise.all([
    supabase.from("users").select("*").eq("agency_id", profile.agency_id).eq("role", "caregiver").order("full_name"),
    supabase.from("family_links").select("*, users(*)").eq("patient_id", id),
    supabase
      .from("patient_updates")
      .select("*, users(full_name)")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  type LinkRow = FamilyLink & { users: AppUser };
  const links = (familyLinks ?? []) as unknown as LinkRow[];

  async function assignAction(formData: FormData) {
    "use server";
    const caregiverId = String(formData.get("caregiver_id") || "") || null;
    await assignCaregiver(id, caregiverId);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{patient.full_name}</h1>
        <p className="text-sm text-slate-500">{patient.address}</p>
      </div>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Caregiver</h2>
        <form action={assignAction} className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-700">Assigned caregiver</label>
            <select
              name="caregiver_id"
              defaultValue={patient.caregiver_id ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {(caregivers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Save
          </button>
        </form>
        {(caregivers ?? []).length === 0 && (
          <p className="text-xs text-slate-400">
            No caregivers yet — invite one from the Caregivers page first.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Schedule</h2>
        <NextVisitEditor patientId={id} initial={patient.next_visit_at} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Family access</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <ul className="divide-y divide-slate-100">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-800">{link.users?.full_name}</span>
                <span className="text-slate-500">
                  {link.users?.email} {link.relationship ? `· ${link.relationship}` : ""}
                </span>
              </li>
            ))}
            {links.length === 0 && <li className="py-2 text-sm text-slate-400">No family invited yet.</li>}
          </ul>

          <form
            action={async (formData: FormData) => {
              "use server";
              await inviteFamily(id, formData);
            }}
            className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4"
          >
            <input name="full_name" placeholder="Full name" required className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <input name="email" type="email" placeholder="Email" required className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <input name="relationship" placeholder="Relationship (e.g. Daughter)" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
              Send invite
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Recent timeline</h2>
        <div className="space-y-2">
          {(recentUpdates ?? []).map((u) => (
            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-medium text-slate-800">
                {(u as unknown as { users: { full_name: string } }).users?.full_name}{" "}
                <span className="text-xs text-slate-400">
                  · {new Date(u.created_at).toLocaleString()}
                </span>
              </p>
              {u.body && <p className="mt-1 text-slate-600">{u.body}</p>}
            </div>
          ))}
          {(recentUpdates ?? []).length === 0 && (
            <p className="text-sm text-slate-400">No updates yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
  );
}
