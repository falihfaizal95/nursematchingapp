"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Radio, LogOut, NotebookPen, TriangleAlert, Info } from "lucide-react";
import type { Patient, Visit } from "@/lib/types";
import { clockIn, submitReportAndClockOut } from "@/lib/actions/caregiver";
import { createClient } from "@/lib/supabase/client";

const PING_INTERVAL_MS = 25_000;

function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS isn't available on this device/browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Location permission is required.")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

function formatElapsed(sinceIso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Ticking clock state lives outside React's render (useSyncExternalStore),
// which keeps render pure while still re-rendering every 30s.
function useElapsed(sinceIso: string | undefined) {
  const subscribe = useCallback((onChange: () => void) => {
    const t = setInterval(onChange, 30_000);
    return () => clearInterval(t);
  }, []);
  const getSnapshot = useCallback(
    () => (sinceIso ? formatElapsed(sinceIso) : ""),
    [sinceIso],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => "");
}

export function CaregiverDashboard({
  patient,
  initialVisit,
}: {
  patient: Patient | null;
  initialVisit: Visit | null;
}) {
  const router = useRouter();
  const [visit, setVisit] = useState(initialVisit);
  const [error, setError] = useState<string | null>(null);
  const [clockingIn, setClockingIn] = useState(false);
  const [report, setReport] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useElapsed(visit?.clock_in_at);

  useEffect(() => {
    if (!visit) return;

    const ping = async () => {
      try {
        const { lat, lng } = await getPosition();
        const supabase = createClient();
        await supabase
          .from("visits")
          .update({ current_lat: lat, current_lng: lng, location_updated_at: new Date().toISOString() })
          .eq("id", visit.id);
      } catch {
        // Best-effort — a missed ping just means a slightly stale pin for family.
      }
    };

    ping();
    pingTimer.current = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
  }, [visit]);

  if (!patient) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-500">
          You&apos;re not assigned to a patient yet. Contact your agency admin.
        </p>
      </div>
    );
  }

  async function handleClockIn() {
    setError(null);
    setClockingIn(true);
    try {
      const { lat, lng } = await getPosition();
      const visitId = await clockIn(patient!.id, lat, lng);
      setVisit({
        id: visitId,
        agency_id: patient!.agency_id,
        patient_id: patient!.id,
        caregiver_id: "",
        clock_in_at: new Date().toISOString(),
        clock_in_lat: lat,
        clock_in_lng: lng,
        clock_in_flagged: false,
        clock_in_distance_m: null,
        current_lat: lat,
        current_lng: lng,
        location_updated_at: new Date().toISOString(),
        clock_out_at: null,
        clock_out_lat: null,
        clock_out_lng: null,
        report: null,
        status: "active",
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clock in.");
    } finally {
      setClockingIn(false);
    }
  }

  async function handleClockOut() {
    if (!report.trim()) {
      setError("Write a short end-of-day report first — it's what the family sees.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { lat, lng } = await getPosition();
      await submitReportAndClockOut(visit!.id, report, lat, lng);
      setVisit(null);
      setReport("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Patient card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-lg font-bold text-blue-700">
            {patient.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your patient</p>
            <p className="truncate text-lg font-bold text-slate-900">{patient.full_name}</p>
            <p className="flex items-center gap-1 truncate text-xs font-medium text-slate-500">
              <MapPin size={11} className="shrink-0" /> {patient.address}
            </p>
          </div>
        </div>
        {patient.allergies && patient.allergies.toLowerCase() !== "none known" && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">
            <TriangleAlert size={14} className="shrink-0" />
            Allergies: {patient.allergies}
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!visit ? (
        <>
          {/* Clock in */}
          <button
            onClick={handleClockIn}
            disabled={clockingIn}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 py-5 text-lg font-bold text-white shadow-lg shadow-blue-600/30 transition active:scale-[0.99] disabled:opacity-60"
          >
            <MapPin size={22} />
            {clockingIn ? "Clocking in..." : "Clock in"}
          </button>
          <p className="flex items-start gap-2 px-1 text-xs font-medium leading-relaxed text-slate-400">
            <Info size={14} className="mt-0.5 shrink-0" />
            Clocking in shares your live location with {patient.full_name.split(" ")[0]}&apos;s family for
            the length of your shift. Sharing stops the moment you clock out.
          </p>
        </>
      ) : (
        <div className="space-y-4">
          {/* Live shift banner */}
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/25">
            <div className="flex items-center justify-between px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="live-dot h-3 w-3 shrink-0 rounded-full bg-white" />
                <div>
                  <p className="text-sm font-bold">On shift</p>
                  <p className="text-xs font-medium text-emerald-50">
                    Since{" "}
                    {new Date(visit.clock_in_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold tabular-nums">{elapsed}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100">elapsed</p>
              </div>
            </div>
            <p className="flex items-center gap-1.5 bg-black/10 px-5 py-2 text-[11px] font-semibold text-emerald-50">
              <Radio size={12} />
              The family can see your location until you clock out.
            </p>
          </div>

          {/* Clock out — two clear steps */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <LogOut size={17} className="text-blue-600" />
              Ready to clock out?
            </h2>

            <div className="mt-4 space-y-4">
              <div className="flex gap-3">
                <StepBadge n={1} done={report.trim().length > 0} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <NotebookPen size={14} className="text-slate-400" />
                    Write your end-of-day report
                  </p>
                  <p className="mb-2 text-xs font-medium text-slate-400">
                    This goes straight to the family — it&apos;s the highlight of their day.
                  </p>
                  <textarea
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                    rows={4}
                    placeholder="How was the day? Meals, mood, meds, anything the family should know..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <StepBadge n={2} done={false} />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={handleClockOut}
                    disabled={submitting || !report.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  >
                    <LogOut size={18} />
                    {submitting ? "Clocking out..." : "Clock out"}
                  </button>
                  {!report.trim() && (
                    <p className="mt-1.5 text-center text-[11px] font-medium text-slate-400">
                      Write your report above to unlock clock-out
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
        done ? "bg-emerald-500 text-white" : "bg-blue-50 text-blue-700"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}
