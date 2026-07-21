"use client";

import { useState } from "react";
import { setNextVisit } from "@/lib/actions/admin";

// datetime-local wants local "YYYY-MM-DDTHH:mm"; convert the stored ISO to
// the admin's local wall-clock for editing.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function NextVisitEditor({ patientId, initial }: { patientId: string; initial: string | null }) {
  const [value, setValue] = useState(toLocalInput(initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await setNextVisit(patientId, value || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex-1 space-y-1">
        <label className="text-sm font-medium text-slate-700">Next scheduled visit</label>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        />
        <p className="text-xs text-slate-400">
          Drives the family&apos;s &ldquo;next visit&rdquo; card and the late / missed alerts.
        </p>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
