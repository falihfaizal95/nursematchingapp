import Link from "next/link";
import { AlertTriangle, MapPinOff } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { deriveShiftStatus, STATUS_LABELS, STATUS_STYLES } from "@/lib/shift-status";
import type { Patient, Shift, Visit, AppUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLiveBoard() {
  const { supabase, profile } = await requireUser("admin");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [{ data: shifts }, { data: openIncidents }] = await Promise.all([
    supabase
      .from("shifts")
      .select("*, patients(*), users!shifts_nurse_id_fkey(*), visits(*)")
      .eq("agency_id", profile.agency_id)
      .gte("start_time", startOfDay.toISOString())
      .lte("start_time", endOfDay.toISOString())
      .order("start_time"),
    supabase
      .from("incidents")
      .select("*, patients(full_name)")
      .eq("agency_id", profile.agency_id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);

  type Row = Shift & { patients: Patient; users: AppUser; visits: Visit[] };
  const rows = (shifts ?? []) as unknown as Row[];

  const counts = { scheduled: 0, checked_in: 0, completed: 0, missed: 0, cancelled: 0 };
  for (const row of rows) {
    const visit = row.visits?.[0];
    counts[deriveShiftStatus(row, visit)]++;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Today&apos;s visits</h1>
        <p className="text-sm text-stone-500">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["scheduled", "checked_in", "completed", "missed", "cancelled"] as const).map((s) => (
          <div key={s} className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold text-stone-900">{counts[s]}</p>
            <p className="text-xs text-stone-500">{STATUS_LABELS[s]}</p>
          </div>
        ))}
      </div>

      {(openIncidents?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-red-800">
            <AlertTriangle size={16} />
            <p className="text-sm font-semibold">Open incidents need review</p>
          </div>
          <ul className="space-y-1">
            {openIncidents!.map((inc) => (
              <li key={inc.id} className="text-sm text-red-700">
                <Link href="/admin/incidents" className="underline">
                  {(inc as unknown as { patients: { full_name: string } }).patients?.full_name} —{" "}
                  {inc.type.replace("_", " ")} ({inc.severity})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Nurse</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Check-in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const visit = row.visits?.[0];
              const status = deriveShiftStatus(row, visit);
              return (
                <tr key={row.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 text-stone-700">
                    {new Date(row.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-900">{row.patients?.full_name}</td>
                  <td className="px-4 py-3 text-stone-700">{row.users?.full_name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {visit?.check_in_flagged && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <MapPinOff size={13} /> {Math.round(visit.check_in_distance_m ?? 0)}m away
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  No visits scheduled today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
