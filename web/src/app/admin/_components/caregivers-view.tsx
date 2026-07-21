"use client";

import { useState } from "react";
import { fetchCaregivers, getCached } from "./admin-data";
import { useCached } from "./use-cached";
import { inviteCaregiver } from "@/lib/actions/admin";

export function CaregiversView() {
  const { data: caregivers, reload } = useCached(getCached("caregivers"), fetchCaregivers);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Caregivers</h1>

      {caregivers === null ? (
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {caregivers.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{c.full_name}</p>
                  <p className="text-slate-500">{c.email}</p>
                </div>
                <p className="text-slate-500">
                  {c.patients?.length
                    ? `Caring for ${c.patients.map((p) => p.full_name).join(", ")}`
                    : "Unassigned"}
                </p>
              </li>
            ))}
            {caregivers.length === 0 && (
              <li className="px-5 py-8 text-center text-slate-400">No caregivers yet.</li>
            )}
          </ul>
        </div>
      )}

      <InviteForm onInvited={reload} />
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
