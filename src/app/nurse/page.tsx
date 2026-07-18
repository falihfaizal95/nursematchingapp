import { requireUser } from "@/lib/current-user";
import { deriveShiftStatus, STATUS_LABELS, STATUS_STYLES } from "@/lib/shift-status";
import type { Shift, Patient, Visit } from "@/lib/types";
import { CheckInButton } from "./_components/check-in-button";
import Link from "next/link";
import { MapPin, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NurseSchedulePage() {
  const { supabase, profile } = await requireUser("nurse");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, patients(*), visits(*)")
    .eq("nurse_id", profile.id)
    .neq("status", "cancelled")
    .gte("start_time", startOfDay.toISOString())
    .lte("start_time", endOfDay.toISOString())
    .order("start_time");

  type Row = Shift & { patients: Patient; visits: Visit[] };
  const rows = (shifts ?? []) as unknown as Row[];

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const visit = row.visits?.[0];
        const status = deriveShiftStatus(row, visit);

        return (
          <div key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold text-stone-900">{row.patients?.full_name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-500">
                  <Clock size={13} />
                  {new Date(row.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                  {new Date(row.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-400">
                  <MapPin size={12} /> {row.patients?.address}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>

            <div className="mt-4">
              {!visit && <CheckInButton shiftId={row.id} />}
              {visit && visit.status === "in_progress" && (
                <Link
                  href={`/nurse/visits/${visit.id}`}
                  className="block w-full rounded-xl bg-teal-600 py-3 text-center text-sm font-semibold text-white active:bg-teal-700"
                >
                  Continue visit
                </Link>
              )}
              {visit && visit.status === "completed" && (
                <Link
                  href={`/nurse/visits/${visit.id}`}
                  className="block w-full rounded-xl border border-stone-200 py-3 text-center text-sm font-medium text-stone-600"
                >
                  View summary
                </Link>
              )}
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="py-16 text-center text-stone-400">No visits scheduled for today.</p>
      )}
    </div>
  );
}
