"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { fetchCaregivers, getCached, type CaregiverWithPatients } from "./admin-data";
import { useCached } from "./use-cached";
import { inviteCaregiver, updateCaregiverProfile } from "@/lib/actions/admin";

export function CaregiversView() {
  const { data: caregivers, reload } = useCached(getCached("caregivers"), fetchCaregivers);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Caregivers</h1>

      {caregivers === null ? (
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : (
        <div className="space-y-2">
          {caregivers.map((c) => (
            <CaregiverRow key={c.id} caregiver={c} onSaved={reload} />
          ))}
          {caregivers.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-400">
              No caregivers yet.
            </p>
          )}
        </div>
      )}

      <InviteForm onInvited={reload} />
    </div>
  );
}

function CaregiverRow({ caregiver, onSaved }: { caregiver: CaregiverWithPatients; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [years, setYears] = useState(caregiver.years_experience?.toString() ?? "");
  const [phone, setPhone] = useState(caregiver.phone ?? "");
  const [bio, setBio] = useState(caregiver.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await updateCaregiverProfile(caregiver.id, {
        years_experience: years.trim() === "" ? null : Number(years),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
      });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3.5 text-left">
        <div>
          <p className="font-semibold text-slate-900">{caregiver.full_name}</p>
          <p className="text-sm text-slate-500">
            {caregiver.patients?.length
              ? `Caring for ${caregiver.patients.map((p) => p.full_name).join(", ")}`
              : "Unassigned"}
          </p>
        </div>
        <ChevronDown size={17} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <p className="text-xs font-medium text-slate-400">{caregiver.email}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Years of experience">
              <input
                type="number"
                min={0}
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Phone (for family to call)">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="555-0100"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Short bio (shown to family)">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              placeholder="Warm, reliable, 5 years with dementia care..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save profile"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        try {
          await inviteCaregiver(formData);
          setDone(true);
          onInvited();
        } finally {
          setPending(false);
        }
      }}
      className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-300 p-5 sm:grid-cols-4"
    >
      <input
        name="full_name"
        placeholder="Full name"
        required
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      />
      <input
        name="phone"
        placeholder="Phone"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      />
      <button
        disabled={pending}
        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Sending..." : done ? "Invited ✓" : "Send invite"}
      </button>
    </form>
  );
}
