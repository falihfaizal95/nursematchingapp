"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Patient } from "@/lib/types";

export function PatientSwitcher({ patients }: { patients: Patient[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("patient") ?? patients[0]?.id;

  return (
    <select
      value={current}
      onChange={(e) => router.push(`${pathname}?patient=${e.target.value}`)}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
    >
      {patients.map((p) => (
        <option key={p.id} value={p.id}>
          {p.full_name}
        </option>
      ))}
    </select>
  );
}
