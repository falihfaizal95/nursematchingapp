import { requireUser } from "@/lib/current-user";
import type { Patient, AppUser, Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

type ActiveRow = Visit & { patients: Patient; users: AppUser };

export default async function AdminHome() {
  const { supabase, profile } = await requireUser("admin");

  const [{ data: active }, { data: patients }, { data: unassigned }] = await Promise.all([
    supabase
      .from("visits")
      .select("*, patients(*), users!visits_caregiver_id_fkey(*)")
      .eq("agency_id", profile.agency_id)
      .eq("status", "active"),
    supabase.from("patients").select("id").eq("agency_id", profile.agency_id),
    supabase.from("patients").select("id").eq("agency_id", profile.agency_id).is("caregiver_id", null),
  ]);

  const rows = (active ?? []) as unknown as ActiveRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Active now</h1>
        <p className="text-sm text-stone-500">Who&apos;s currently clocked in</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-2xl font-semibold text-stone-900">{rows.length}</p>
          <p className="text-xs text-stone-500">Clocked in now</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-2xl font-semibold text-stone-900">{patients?.length ?? 0}</p>
          <p className="text-xs text-stone-500">Total patients</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-2xl font-semibold text-amber-800">{unassigned?.length ?? 0}</p>
          <p className="text-xs text-amber-700">Unassigned patients</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4">
            <div>
              <p className="font-medium text-stone-900">{row.patients?.full_name}</p>
              <p className="text-sm text-stone-500">{row.users?.full_name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-700">
                Since {new Date(row.clock_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
              {row.clock_in_flagged && (
                <p className="text-xs font-medium text-amber-700">
                  Checked in {Math.round(row.clock_in_distance_m ?? 0)}m from home
                </p>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 py-8 text-center text-stone-400">
            No one is clocked in right now.
          </p>
        )}
      </div>
    </div>
  );
}
