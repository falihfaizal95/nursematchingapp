"use client";

import { useState } from "react";
import { CheckCircle2, TriangleAlert, Clock, Radio } from "lucide-react";
import { fetchTodayVisits, fetchPatients, fetchConcerns, getCached } from "./admin-data";
import { useCached } from "./use-cached";
import { resolveConcern } from "@/lib/actions/admin";

const LATE_MIN = 15;
const MISSED_MIN = 30;

export function ActiveView() {
  const { data: today } = useCached(getCached("today"), fetchTodayVisits);
  const { data: patients } = useCached(getCached("patients"), fetchPatients);
  const { data: concerns, reload: reloadConcerns } = useCached(getCached("concerns"), fetchConcerns);

  const visits = today ?? [];
  const onSite = visits.filter((v) => v.status === "active");
  const completed = visits.filter((v) => v.status === "completed");
  const openConcerns = (concerns ?? []).filter((c) => c.concern_flag);

  // Late / missed: a patient with a next_visit_at earlier today and no
  // clock-in recorded for today. Snapshot "now" once (lazy init keeps
  // render pure).
  const [now] = useState(() => Date.now());
  const alerts = (patients ?? [])
    .filter((p) => p.next_visit_at && new Date(p.next_visit_at).toDateString() === new Date().toDateString())
    .filter((p) => !visits.some((v) => v.patient_id === p.id))
    .map((p) => {
      const mins = (now - new Date(p.next_visit_at!).getTime()) / 60_000;
      if (mins >= MISSED_MIN) return { p, kind: "missed" as const, mins };
      if (mins >= LATE_MIN) return { p, kind: "late" as const, mins };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Today</h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat value={today ? onSite.length : null} label="On shift now" tone="green" />
        <Stat value={today ? completed.length : null} label="Completed today" />
        <Stat value={concerns ? openConcerns.length + alerts.length : null} label="Need attention" tone="amber" />
      </div>

      {(alerts.length > 0 || openConcerns.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Needs attention</h2>
          {alerts.map(({ p, kind, mins }) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-xl border p-4 ${
                kind === "missed" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              <TriangleAlert size={18} className={kind === "missed" ? "text-red-600" : "text-amber-600"} />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{p.full_name}</p>
                <p className={`text-xs font-medium ${kind === "missed" ? "text-red-700" : "text-amber-700"}`}>
                  {kind === "missed" ? "No check-in" : "Running late"} — expected{" "}
                  {new Date(p.next_visit_at!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (
                  {Math.round(mins)}m ago)
                </p>
              </div>
            </div>
          ))}
          {openConcerns.map((c) => (
            <div key={c.id} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{c.patients?.full_name}</p>
                <p className="text-sm text-amber-800">{c.concern_text}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  Flagged by {c.users?.full_name} · {new Date(c.clock_in_at).toLocaleString()}
                </p>
              </div>
              <ResolveButton
                visitId={c.id}
                onDone={reloadConcerns}
              />
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">On shift now</h2>
        {today === null ? (
          <RowSkeletons />
        ) : onSite.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm font-medium text-slate-400">
            No one is clocked in right now.
          </p>
        ) : (
          onSite.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{v.patients?.full_name}</p>
                <p className="text-sm text-slate-500">{v.users?.full_name}</p>
              </div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <Radio size={13} className="live-dot rounded-full" />
                Since {new Date(v.clock_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          ))
        )}
      </section>

      {completed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Completed today</h2>
          {completed.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{v.patients?.full_name}</p>
                <p className="text-sm text-slate-500">{v.users?.full_name}</p>
              </div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <CheckCircle2 size={13} className="text-emerald-500" />
                {v.clock_out_at && new Date(v.clock_out_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function ResolveButton({ visitId, onDone }: { visitId: string; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      onClick={async () => {
        setPending(true);
        try {
          await resolveConcern(visitId);
          onDone();
        } finally {
          setPending(false);
        }
      }}
      disabled={pending}
      className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100 disabled:opacity-50"
    >
      {pending ? "…" : "Reviewed"}
    </button>
  );
}

function Stat({
  value,
  label,
  tone = "default",
}: {
  value: number | null;
  label: string;
  tone?: "default" | "amber" | "green";
}) {
  const styles =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50"
        : "border-slate-200 bg-white";
  const num =
    tone === "amber" ? "text-amber-800" : tone === "green" ? "text-emerald-700" : "text-slate-900";
  const lbl =
    tone === "amber" ? "text-amber-700" : tone === "green" ? "text-emerald-700" : "text-slate-500";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      {value === null ? (
        <div className="h-8 w-8 animate-pulse rounded-md bg-slate-200/70" />
      ) : (
        <p className={`text-2xl font-bold ${num}`}>{value}</p>
      )}
      <p className={`flex items-center gap-1 text-xs font-medium ${lbl}`}>
        {tone === "green" && <Clock size={11} />}
        {label}
      </p>
    </div>
  );
}

function RowSkeletons() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
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
