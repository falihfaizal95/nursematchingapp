"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPinOff, LogOut, Check, Camera } from "lucide-react";
import type { Visit, Patient, VisitTask, CareTask, Vitals, VisitNote, Photo } from "@/lib/types";
import { toggleVisitTask, saveVitals, saveVisitNote, checkOut } from "@/lib/actions/nurse-visit";
import { createClient } from "@/lib/supabase/client";

type TaskRow = VisitTask & { care_tasks: CareTask };

export function VisitFlow({
  visit,
  visitTasks,
  vitals,
  note,
  photos,
}: {
  visit: Visit & { patients: Patient };
  visitTasks: TaskRow[];
  vitals: Vitals | null;
  note: VisitNote | null;
  photos: Photo[];
}) {
  const readOnly = visit.status === "completed";
  const router = useRouter();
  const [tasks, setTasks] = useState(visitTasks);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPending, startCheckout] = useTransition();

  const completedCount = tasks.filter((t) => t.completed).length;

  function handleToggle(task: TaskRow) {
    const next = !task.completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    toggleVisitTask(task.id, next, visit.id).catch(() => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !next } : t)));
    });
  }

  function handleCheckOut() {
    setCheckoutError(null);
    if (!navigator.geolocation) {
      setCheckoutError("GPS isn't available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        startCheckout(async () => {
          try {
            await checkOut(visit.id, position.coords.latitude, position.coords.longitude);
            router.push("/nurse");
          } catch (e) {
            setCheckoutError(e instanceof Error ? e.message : "Check-out failed.");
          }
        });
      },
      () => setCheckoutError("Location permission is required to check out."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-lg font-semibold text-stone-900">{visit.patients.full_name}</p>
        <p className="text-sm text-stone-500">{visit.patients.address}</p>
        {visit.check_in_at && (
          <p className="mt-1 text-xs text-stone-400">
            Checked in {new Date(visit.check_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
        {visit.check_in_flagged && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">
            <MapPinOff size={13} /> Checked in {Math.round(visit.check_in_distance_m ?? 0)}m from the patient&apos;s
            address — flagged for admin review.
          </p>
        )}
        {visit.patients.allergies && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            Allergies: {visit.patients.allergies}
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900">Care tasks</h2>
          <span className="text-xs text-stone-500">
            {completedCount}/{tasks.length}
          </span>
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                disabled={readOnly}
                onClick={() => handleToggle(t)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                  t.completed
                    ? "border-teal-200 bg-teal-50 text-teal-900"
                    : "border-stone-200 bg-white text-stone-700"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    t.completed ? "border-teal-600 bg-teal-600 text-white" : "border-stone-300"
                  }`}
                >
                  {t.completed && <Check size={13} />}
                </span>
                <span>
                  <span className="font-medium">{t.care_tasks.label}</span>
                  {t.care_tasks.instructions && (
                    <span className="block text-xs text-stone-400">{t.care_tasks.instructions}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {tasks.length === 0 && <p className="text-sm text-stone-400">No care tasks on file for this patient.</p>}
        </ul>
      </section>

      <VitalsSection visitId={visit.id} patientId={visit.patient_id} vitals={vitals} readOnly={readOnly} />
      <NoteSection visitId={visit.id} note={note} readOnly={readOnly} />
      <PhotosSection visitId={visit.id} patientId={visit.patient_id} photos={photos} readOnly={readOnly} />

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white p-4">
          {checkoutError && <p className="mb-2 text-center text-xs text-red-600">{checkoutError}</p>}
          <button
            onClick={handleCheckOut}
            disabled={checkoutPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white active:bg-stone-800 disabled:opacity-60"
          >
            <LogOut size={16} />
            {checkoutPending ? "Checking out..." : "Check out"}
          </button>
        </div>
      )}
    </div>
  );
}

function VitalsSection({
  visitId,
  patientId,
  vitals,
  readOnly,
}: {
  visitId: string;
  patientId: string;
  vitals: Vitals | null;
  readOnly: boolean;
}) {
  const [saved, setSaved] = useState(!!vitals);
  const [pending, startTransition] = useTransition();

  if (readOnly) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-2 font-semibold text-stone-900">Vitals</h2>
        {vitals ? (
          <dl className="grid grid-cols-2 gap-2 text-sm text-stone-700">
            <Dl label="BP" value={vitals.bp_systolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : "—"} />
            <Dl label="Heart rate" value={vitals.heart_rate ? `${vitals.heart_rate} bpm` : "—"} />
            <Dl label="Glucose" value={vitals.glucose ? `${vitals.glucose} mg/dL` : "—"} />
            <Dl label="Temp" value={vitals.temperature ? `${vitals.temperature}°F` : "—"} />
            <Dl label="Pain" value={vitals.pain_level !== null ? `${vitals.pain_level}/10` : "—"} />
            <Dl label="Mood" value={vitals.mood || "—"} />
          </dl>
        ) : (
          <p className="text-sm text-stone-400">No vitals recorded.</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-stone-900">Vitals {saved && <span className="text-xs font-normal text-teal-600">saved</span>}</h2>
      <form
        action={(formData) => {
          startTransition(async () => {
            await saveVitals(visitId, patientId, formData);
            setSaved(true);
          });
        }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <NumInput name="bp_systolic" label="BP systolic" defaultValue={vitals?.bp_systolic} />
          <NumInput name="bp_diastolic" label="BP diastolic" defaultValue={vitals?.bp_diastolic} />
        </div>
        <NumInput name="heart_rate" label="Heart rate (bpm)" defaultValue={vitals?.heart_rate} />
        <NumInput name="glucose" label="Glucose (mg/dL)" defaultValue={vitals?.glucose} />
        <NumInput name="temperature" label="Temp (°F)" step="0.1" defaultValue={vitals?.temperature} />
        <NumInput name="pain_level" label="Pain (0-10)" min={0} max={10} defaultValue={vitals?.pain_level} />
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-stone-600">Mood</label>
          <select name="mood" defaultValue={vitals?.mood ?? ""} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
            <option value="">Select</option>
            <option value="content">Content</option>
            <option value="anxious">Anxious</option>
            <option value="tired">Tired</option>
            <option value="agitated">Agitated</option>
            <option value="cheerful">Cheerful</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="col-span-2 rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save vitals"}
        </button>
      </form>
    </section>
  );
}

function NoteSection({ visitId, note, readOnly }: { visitId: string; note: VisitNote | null; readOnly: boolean }) {
  const [saved, setSaved] = useState(!!note);
  const [pending, startTransition] = useTransition();

  if (readOnly) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-2 font-semibold text-stone-900">Visit note</h2>
        <p className="text-sm font-medium text-stone-800">{note?.summary || "—"}</p>
        {note?.body && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{note.body}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-stone-900">Visit note {saved && <span className="text-xs font-normal text-teal-600">saved</span>}</h2>
      <form
        action={(formData) => {
          startTransition(async () => {
            await saveVisitNote(visitId, formData);
            setSaved(true);
          });
        }}
        className="space-y-3"
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">Summary</label>
          <input
            name="summary"
            required
            defaultValue={note?.summary}
            placeholder="e.g. Stable visit, meds given, wound healing well"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">Details (optional)</label>
          <textarea
            name="body"
            rows={4}
            defaultValue={note?.body ?? ""}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save note"}
        </button>
      </form>
    </section>
  );
}

function PhotosSection({
  visitId,
  patientId,
  photos,
  readOnly,
}: {
  visitId: string;
  patientId: string;
  photos: Photo[];
  readOnly: boolean;
}) {
  const [items, setItems] = useState(photos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const path = `${patientId}/${visitId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("visit-photos").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: row, error: insertError } = await supabase
        .from("photos")
        .insert({ visit_id: visitId, patient_id: patientId, storage_path: path })
        .select("*")
        .single();
      if (insertError) throw insertError;

      setItems((prev) => [row as Photo, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-stone-900">Photos</h2>
      {!readOnly && (
        <label className="mb-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-600">
          <Camera size={16} />
          {uploading ? "Uploading..." : "Add photo"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      )}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        {items.map((p) => (
          <PhotoThumb key={p.id} photo={p} />
        ))}
      </div>
      {items.length === 0 && <p className="text-sm text-stone-400">No photos yet.</p>}
    </section>
  );
}

function PhotoThumb({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.storage
      .from("visit-photos")
      .createSignedUrl(photo.storage_path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [photo.storage_path]);

  return (
    <div className="aspect-square overflow-hidden rounded-lg bg-stone-100">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={photo.caption || "Visit photo"} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function NumInput({
  name,
  label,
  defaultValue,
  step,
  min,
  max,
}: {
  name: string;
  label: string;
  defaultValue?: number | null;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-stone-600">{label}</label>
      <input
        type="number"
        name={name}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue ?? undefined}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

function Dl({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
