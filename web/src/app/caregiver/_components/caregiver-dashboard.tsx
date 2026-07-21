"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Radio,
  LogOut,
  Info,
  TriangleAlert,
  Camera,
  Check,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { AppUser, Patient, Visit, Mood, CareTaskField } from "@/lib/types";
import { CARE_TASKS } from "@/lib/types";
import {
  clockIn,
  toggleTask,
  setMood as setMoodAction,
  setPain as setPainAction,
  saveNote,
  flagConcern,
  clockOut,
} from "@/lib/actions/caregiver";
import { uploadVisitPhoto } from "@/lib/caregiver-photo";
import { getSignedPhotoUrl } from "@/lib/family-updates";

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: "great", emoji: "😊", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "unwell", emoji: "😟", label: "Unwell" },
];

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

function useElapsed(sinceIso: string | undefined) {
  const subscribe = useCallback((onChange: () => void) => {
    const t = setInterval(onChange, 30_000);
    return () => clearInterval(t);
  }, []);
  const getSnapshot = useCallback(() => (sinceIso ? formatElapsed(sinceIso) : ""), [sinceIso]);
  return useSyncExternalStore(subscribe, getSnapshot, () => "");
}

function makeVisit(patient: Patient, id: string, lat: number, lng: number): Visit {
  return {
    id,
    agency_id: patient.agency_id,
    patient_id: patient.id,
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
    ate_breakfast: false,
    ate_lunch: false,
    ate_dinner: false,
    medication_given: false,
    showered: false,
    walked: false,
    drank_water: false,
    bathroom_assisted: false,
    mood: null,
    pain_level: null,
    concern_flag: false,
    concern_text: null,
    photo_path: null,
    status: "active",
    created_at: new Date().toISOString(),
  };
}

export function CaregiverDashboard({
  patient,
  initialVisit,
  caregiver,
}: {
  patient: Patient | null;
  initialVisit: Visit | null;
  caregiver: AppUser;
}) {
  const router = useRouter();
  const [visit, setVisit] = useState(initialVisit);
  const [error, setError] = useState<string | null>(null);
  const [clockingIn, setClockingIn] = useState(false);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = visit?.status === "active";

  useEffect(() => {
    if (!active || !visit) return;
    const supabaseImport = import("@/lib/supabase/client");
    const ping = async () => {
      try {
        const { lat, lng } = await getPosition();
        const { createClient } = await supabaseImport;
        await createClient()
          .from("visits")
          .update({ current_lat: lat, current_lng: lng, location_updated_at: new Date().toISOString() })
          .eq("id", visit.id);
      } catch {
        /* best effort */
      }
    };
    ping();
    pingTimer.current = setInterval(ping, 25_000);
    return () => {
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
  }, [active, visit]);

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
      const id = await clockIn(patient!.id, lat, lng);
      setVisit(makeVisit(patient!, id, lat, lng));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clock in.");
    } finally {
      setClockingIn(false);
    }
  }

  return (
    <div className="space-y-4">
      <PatientCard patient={patient} />

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!visit && (
        <ClockInPanel patient={patient} onClockIn={handleClockIn} pending={clockingIn} />
      )}

      {visit && visit.status === "completed" && <CompletedPanel visit={visit} />}

      {visit && visit.status === "active" && (
        <ActiveVisit
          visit={visit}
          caregiver={caregiver}
          patient={patient}
          onChange={setVisit}
          onCheckedOut={() => {
            setVisit({ ...visit, status: "completed", clock_out_at: new Date().toISOString() });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PatientCard({ patient }: { patient: Patient }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-lg font-bold text-blue-700">
          {patient.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Today&apos;s visit</p>
          <p className="truncate text-lg font-bold text-slate-900">{patient.full_name}</p>
          <p className="flex items-center gap-1 truncate text-xs font-medium text-slate-500">
            <MapPin size={11} className="shrink-0" /> {patient.address}
          </p>
        </div>
      </div>
      {patient.allergies && patient.allergies.toLowerCase() !== "none known" && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">
          <TriangleAlert size={14} className="shrink-0" /> Allergies: {patient.allergies}
        </p>
      )}
    </div>
  );
}

function ClockInPanel({
  patient,
  onClockIn,
  pending,
}: {
  patient: Patient;
  onClockIn: () => void;
  pending: boolean;
}) {
  return (
    <>
      {patient.next_visit_at && (
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500">
          <Clock size={14} />
          Expected{" "}
          {new Date(patient.next_visit_at).toLocaleString(undefined, {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
      <button
        onClick={onClockIn}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 py-5 text-lg font-bold text-white shadow-lg shadow-blue-600/30 transition active:scale-[0.99] disabled:opacity-60"
      >
        <MapPin size={22} />
        {pending ? "Clocking in..." : "Clock in"}
      </button>
      <p className="flex items-start gap-2 px-1 text-xs font-medium leading-relaxed text-slate-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        Clocking in shares your live location with {patient.full_name.split(" ")[0]}&apos;s family for the
        length of your shift. Sharing stops the moment you clock out.
      </p>
    </>
  );
}

function CompletedPanel({ visit }: { visit: Visit }) {
  const done = CARE_TASKS.filter((t) => visit[t.field as CareTaskField]).length;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
      <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
      <p className="mt-2 text-lg font-bold text-emerald-900">Today&apos;s visit is complete</p>
      <p className="text-sm font-medium text-emerald-700">
        {done}/{CARE_TASKS.length} care tasks done
        {visit.clock_out_at &&
          ` · clocked out at ${new Date(visit.clock_out_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`}
      </p>
    </div>
  );
}

function ActiveVisit({
  visit,
  caregiver,
  patient,
  onChange,
  onCheckedOut,
}: {
  visit: Visit;
  caregiver: AppUser;
  patient: Patient;
  onChange: (v: Visit) => void;
  onCheckedOut: () => void;
}) {
  const elapsed = useElapsed(visit.clock_in_at);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  async function handleCheckOut() {
    setCheckoutError(null);
    setCheckingOut(true);
    try {
      const { lat, lng } = await getPosition();
      await clockOut(visit.id, lat, lng);
      onCheckedOut();
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Couldn't clock out.");
      setCheckingOut(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Live banner */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/25">
        <div className="flex items-center justify-between px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="live-dot h-3 w-3 shrink-0 rounded-full bg-white" />
            <div>
              <p className="text-sm font-bold">On shift</p>
              <p className="text-xs font-medium text-emerald-50">
                Since {new Date(visit.clock_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums">{elapsed}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100">elapsed</p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 bg-black/10 px-5 py-2 text-[11px] font-semibold text-emerald-50">
          <Radio size={12} /> The family can see your location until you clock out.
        </p>
      </div>

      <ChecklistCard visit={visit} onChange={onChange} />
      <MoodCard visit={visit} onChange={onChange} />
      <PainCard visit={visit} onChange={onChange} />
      <NoteCard visit={visit} onChange={onChange} />
      <PhotoCard visit={visit} caregiver={caregiver} patient={patient} onChange={onChange} />
      <ConcernCard visit={visit} onChange={onChange} />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {checkoutError && <p className="mb-2 text-center text-xs text-red-600">{checkoutError}</p>}
        <button
          onClick={handleCheckOut}
          disabled={checkingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          <LogOut size={18} />
          {checkingOut ? "Clocking out..." : "Clock out"}
        </button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ChecklistCard({ visit, onChange }: { visit: Visit; onChange: (v: Visit) => void }) {
  function toggle(field: CareTaskField, label: string) {
    const next = !visit[field];
    onChange({ ...visit, [field]: next });
    toggleTask(visit.id, field, label, next).catch(() => onChange({ ...visit, [field]: !next }));
  }
  const done = CARE_TASKS.filter((t) => visit[t.field]).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Care checklist</h2>
        <span className="text-xs font-semibold text-slate-400">
          {done}/{CARE_TASKS.length}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CARE_TASKS.map((t) => {
          const on = visit[t.field];
          return (
            <button
              key={t.field}
              onClick={() => toggle(t.field, t.label)}
              className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition ${
                on
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                }`}
              >
                {on && <Check size={13} strokeWidth={3} />}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MoodCard({ visit, onChange }: { visit: Visit; onChange: (v: Visit) => void }) {
  function pick(m: Mood) {
    onChange({ ...visit, mood: m });
    setMoodAction(visit.id, m).catch(() => {});
  }
  return (
    <Card title="How are they feeling?">
      <div className="grid grid-cols-4 gap-2">
        {MOODS.map((m) => {
          const on = visit.mood === m.value;
          return (
            <button
              key={m.value}
              onClick={() => pick(m.value)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 transition ${
                on ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className={`text-[11px] font-semibold ${on ? "text-blue-700" : "text-slate-500"}`}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function PainCard({ visit, onChange }: { visit: Visit; onChange: (v: Visit) => void }) {
  const [val, setVal] = useState<number>(visit.pain_level ?? 0);
  const [set, setSet] = useState(visit.pain_level !== null);

  function commit(n: number) {
    setSet(true);
    onChange({ ...visit, pain_level: n });
    setPainAction(visit.id, n).catch(() => {});
  }

  return (
    <Card title="Pain level">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={10}
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          onPointerUp={() => commit(val)}
          onKeyUp={() => commit(val)}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
        />
        <span
          className={`w-10 rounded-lg py-1 text-center text-sm font-bold ${
            set ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-400"
          }`}
        >
          {set ? `${val}` : "—"}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-slate-400">0 = no pain · 10 = worst pain</p>
    </Card>
  );
}

function NoteCard({ visit, onChange }: { visit: Visit; onChange: (v: Visit) => void }) {
  const [text, setText] = useState(visit.report ?? "");
  const [saved, setSaved] = useState(false);

  function save() {
    if (text === (visit.report ?? "")) return;
    onChange({ ...visit, report: text });
    saveNote(visit.id, text)
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <Card title="Note for the family">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={3}
        placeholder="How was the day? Families love reading this — 'She was in a great mood, we watched TV together.'"
        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      />
      {saved && <p className="mt-1 text-xs font-semibold text-emerald-600">Saved</p>}
    </Card>
  );
}

function PhotoCard({
  visit,
  caregiver,
  patient,
  onChange,
}: {
  visit: Visit;
  caregiver: AppUser;
  patient: Patient;
  onChange: (v: Visit) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visit.photo_path) getSignedPhotoUrl(visit.photo_path).then(setUrl);
  }, [visit.photo_path]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const path = await uploadVisitPhoto({
        visitId: visit.id,
        patientId: patient.id,
        agencyId: caregiver.agency_id,
        authorId: caregiver.id,
        file,
      });
      onChange({ ...visit, photo_path: path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <Card title="Photo (optional)">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Visit" className="mb-3 max-h-56 w-full rounded-xl object-cover" />
      )}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition hover:border-blue-400 hover:text-blue-600">
        <Camera size={16} />
        {uploading ? "Uploading..." : visit.photo_path ? "Replace photo" : "Add a photo"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-2 text-xs font-medium text-slate-400">
        One photo of a smile removes enormous anxiety for the family.
      </p>
    </Card>
  );
}

function ConcernCard({ visit, onChange }: { visit: Visit; onChange: (v: Visit) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  if (visit.concern_flag) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
          <TriangleAlert size={15} /> Concern flagged — the agency has been notified
        </p>
        {visit.concern_text && <p className="mt-1 text-sm text-amber-700">{visit.concern_text}</p>}
      </div>
    );
  }

  async function submit() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await flagConcern(visit.id, text);
      onChange({ ...visit, concern_flag: true, concern_text: text.trim() });
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
        >
          <TriangleAlert size={16} /> Flag a concern
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-900">Flag a concern</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="What's the concern? This alerts the agency immediately."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving || !text.trim()}
              className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "Sending..." : "Send alert"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
