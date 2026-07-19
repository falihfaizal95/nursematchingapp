import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import type { AppUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const { supabase, profile } = await requireUser("admin");

  const { data: patients } = await supabase
    .from("patients")
    .select("*, users!patients_caregiver_id_fkey(full_name)")
    .eq("agency_id", profile.agency_id)
    .order("full_name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">Patients</h1>
        <Link
          href="/admin/patients/new"
          className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus size={16} /> Add patient
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(patients ?? []).map((p) => {
          const caregiver = (p as unknown as { users: AppUser | null }).users;
          return (
            <Link
              key={p.id}
              href={`/admin/patients/${p.id}`}
              className="rounded-xl border border-stone-200 bg-white p-4 transition hover:border-teal-300 hover:shadow-sm"
            >
              <p className="font-medium text-stone-900">{p.full_name}</p>
              <p className="mt-1 text-sm text-stone-500">{p.primary_condition || "No condition on file"}</p>
              <p className="mt-2 text-xs text-stone-400">{p.address}</p>
              <p className="mt-2 text-xs font-medium">
                {caregiver ? (
                  <span className="text-teal-700">Caregiver: {caregiver.full_name}</span>
                ) : (
                  <span className="text-amber-700">No caregiver assigned</span>
                )}
              </p>
            </Link>
          );
        })}
        {(patients ?? []).length === 0 && (
          <p className="col-span-full py-8 text-center text-stone-400">No patients yet.</p>
        )}
      </div>
    </div>
  );
}
