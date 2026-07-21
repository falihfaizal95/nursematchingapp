"use client";

import { fetchActiveVisits, fetchPatients, getCached } from "./admin-data";
import { useCached } from "./use-cached";

export function ActiveView() {
  const { data: active } = useCached(getCached("active"), fetchActiveVisits);
  const { data: patients } = useCached(getCached("patients"), fetchPatients);

  const rows = active ?? [];
  const total = patients?.length ?? null;
  const unassigned = patients ? patients.filter((p) => !p.caregiver_id).length : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Active now</h1>
        <p className="text-sm text-slate-500">Who&apos;s currently clocked in</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat value={active ? rows.length : null} label="Clocked in now" />
        <Stat value={total} label="Total patients" />
        <Stat value={unassigned} label="Unassigned patients" tone="amber" />
      </div>

      <div className="space-y-3">
        {active === null ? (
          <RowSkeletons />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm font-medium text-slate-400">
            No one is clocked in right now.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{row.patients?.full_name}</p>
                <p className="text-sm text-slate-500">{row.users?.full_name}</p>
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-600">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Since{" "}
                  {new Date(row.clock_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
                {row.clock_in_flagged && (
                  <p className="text-xs font-medium text-amber-700">
                    Clocked in {Math.round(row.clock_in_distance_m ?? 0)}m from home
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  tone = "default",
}: {
  value: number | null;
  label: string;
  tone?: "default" | "amber";
}) {
  const amber = tone === "amber";
  return (
    <div
      className={`rounded-xl border p-4 ${amber ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}
    >
      {value === null ? (
        <div className="h-8 w-8 animate-pulse rounded-md bg-slate-200/70" />
      ) : (
        <p className={`text-2xl font-bold ${amber ? "text-amber-800" : "text-slate-900"}`}>{value}</p>
      )}
      <p className={`text-xs font-medium ${amber ? "text-amber-700" : "text-slate-500"}`}>{label}</p>
    </div>
  );
}

function RowSkeletons() {
  return (
    <>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200/70" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200/50" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200/50" />
        </div>
      ))}
    </>
  );
}
