import { createClient } from "@/lib/supabase/client";
import type { AppUser, Patient, Visit } from "@/lib/types";

// Browser-side data for the admin console. All queries run directly against
// Supabase from the browser (RLS scopes everything to the admin's agency),
// and results are cached at module scope so switching tabs — or returning
// to the console from a detail page — is instant, with a background refresh.

export type PatientWithCaregiver = Patient & { users: { full_name: string } | null };
export type ActiveVisitRow = Visit & { patients: Patient; users: AppUser };
export type CaregiverWithPatients = AppUser & { patients: { full_name: string }[] };

type Cache = {
  patients: PatientWithCaregiver[] | null;
  active: ActiveVisitRow[] | null;
  caregivers: CaregiverWithPatients[] | null;
};

const cache: Cache = { patients: null, active: null, caregivers: null };

export function getCached<K extends keyof Cache>(key: K): Cache[K] {
  return cache[key];
}

export async function fetchPatients(): Promise<PatientWithCaregiver[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*, users!patients_caregiver_id_fkey(full_name)")
    .order("full_name");
  if (error) throw new Error(error.message);
  cache.patients = (data ?? []) as unknown as PatientWithCaregiver[];
  return cache.patients;
}

export async function fetchActiveVisits(): Promise<ActiveVisitRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*, patients(*), users!visits_caregiver_id_fkey(*)")
    .eq("status", "active")
    .order("clock_in_at", { ascending: false });
  if (error) throw new Error(error.message);
  cache.active = (data ?? []) as unknown as ActiveVisitRow[];
  return cache.active;
}

export async function fetchCaregivers(): Promise<CaregiverWithPatients[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*, patients!patients_caregiver_id_fkey(full_name)")
    .eq("role", "caregiver")
    .order("full_name");
  if (error) throw new Error(error.message);
  cache.caregivers = (data ?? []) as unknown as CaregiverWithPatients[];
  return cache.caregivers;
}

// Kick off all three in parallel; callers read from the cache as each lands.
export function warmAll() {
  fetchPatients().catch(() => {});
  fetchActiveVisits().catch(() => {});
  fetchCaregivers().catch(() => {});
}
