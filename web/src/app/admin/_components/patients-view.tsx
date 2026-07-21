"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { fetchPatients, getCached } from "./admin-data";
import { useCached } from "./use-cached";

export function PatientsView() {
  const { data: patients } = useCached(getCached("patients"), fetchPatients);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patients</h1>
        <Link
          href="/admin/patients/new"
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
        >
          <Plus size={16} /> Add patient
        </Link>
      </div>

      {patients === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <p className="py-8 text-center text-slate-400">No patients yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((p) => (
            <Link
              key={p.id}
              href={`/admin/patients/${p.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <p className="font-semibold text-slate-900">{p.full_name}</p>
              <p className="mt-1 text-sm text-slate-500">{p.primary_condition || "No condition on file"}</p>
              <p className="mt-2 text-xs text-slate-400">{p.address}</p>
              <p className="mt-2 text-xs font-semibold">
                {p.users ? (
                  <span className="text-blue-700">Caregiver: {p.users.full_name}</span>
                ) : (
                  <span className="text-amber-700">No caregiver assigned</span>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
