import { createClient } from "@/lib/supabase/client";
import type { AppUser, Patient, Visit } from "@/lib/types";

// Browser-side data for the admin console. All queries run directly against
// Supabase from the browser (RLS scopes everything to the admin's agency),
// and results are cached at module scope so switching tabs — or returning
// to the console from a detail page — is instant, with a background refresh.

export type PatientWithCaregiver = Patient & { users: { full_name: string } | null };
export type ActiveVisitRow = Visit & { patients: Patient; users: AppUser };
export type VisitRow = Visit & { patients: { full_name: string }; users: { full_name: string } };
export type CaregiverWithPatients = AppUser & { patients: { full_name: string }[] };

type Cache = {
  patients: PatientWithCaregiver[] | null;
  today: VisitRow[] | null;
  concerns: VisitRow[] | null;
  caregivers: CaregiverWithPatients[] | null;
};

const cache: Cache = { patients: null, today: null, concerns: null, caregivers: null };

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

export async function fetchTodayVisits(): Promise<VisitRow[]> {
  const supabase = createClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("visits")
    .select("*, patients(full_name), users!visits_caregiver_id_fkey(full_name)")
    .gte("clock_in_at", start.toISOString())
    .order("clock_in_at", { ascending: false });
  if (error) throw new Error(error.message);
  cache.today = (data ?? []) as unknown as VisitRow[];
  return cache.today;
}

export async function fetchConcerns(): Promise<VisitRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*, patients(full_name), users!visits_caregiver_id_fkey(full_name)")
    .eq("concern_flag", true)
    .order("clock_in_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  cache.concerns = (data ?? []) as unknown as VisitRow[];
  return cache.concerns;
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

// Kick off everything in parallel; callers read from the cache as each lands.
export function warmAll() {
  fetchPatients().catch(() => {});
  fetchTodayVisits().catch(() => {});
  fetchConcerns().catch(() => {});
  fetchCaregivers().catch(() => {});
}
