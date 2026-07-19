"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Radio, LogOut } from "lucide-react";
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
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
        <p className="text-sm text-stone-500">
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
      setError("Write a short end-of-day report before clocking out.");
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
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Assigned patient</p>
        <p className="mt-1 text-lg font-semibold text-stone-900">{patient.full_name}</p>
        <p className="text-sm text-stone-500">{patient.address}</p>
        {patient.allergies && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            Allergies: {patient.allergies}
          </p>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!visit ? (
        <button
          onClick={handleClockIn}
          disabled={clockingIn}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-4 text-base font-semibold text-white active:bg-teal-700 disabled:opacity-60"
        >
          <MapPin size={18} />
          {clockingIn ? "Clocking in..." : "Clock in"}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
            <Radio size={15} className="animate-pulse" />
            <span>
              Clocked in since{" "}
              {new Date(visit.clock_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} —
              your family can see your location until you clock out.
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <label className="text-sm font-medium text-stone-700">End-of-day report</label>
            <p className="mb-2 text-xs text-stone-400">Required before you can clock out.</p>
            <textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              rows={5}
              placeholder="What happened today? Anything the family should know?"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <button
            onClick={handleClockOut}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-4 text-base font-semibold text-white active:bg-stone-800 disabled:opacity-60"
          >
            <LogOut size={18} />
            {submitting ? "Submitting..." : "Submit report & clock out"}
          </button>
        </div>
      )}
    </div>
  );
}
