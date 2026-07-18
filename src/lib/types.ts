// Hand-maintained types mirroring supabase/migrations/0001_init.sql.
// If you have the Supabase CLI linked, prefer `supabase gen types typescript`
// to regenerate this from the live schema.

export type UserRole = "admin" | "nurse" | "family";
export type ShiftStatus = "scheduled" | "checked_in" | "completed" | "missed" | "cancelled";
export type VisitStatus = "in_progress" | "completed" | "flagged";
export type TaskCategory =
  | "medication"
  | "wound_care"
  | "bathing"
  | "meals"
  | "mobility"
  | "vitals"
  | "other";
export type IncidentType = "fall" | "refusal" | "medication_error" | "concern" | "other";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "reviewed" | "resolved";

export interface Agency {
  id: string;
  name: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  agency_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  agency_id: string;
  full_name: string;
  date_of_birth: string | null;
  address: string;
  lat: number;
  lng: number;
  primary_condition: string | null;
  allergies: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  photo_url: string | null;
  active: boolean;
  created_at: string;
}

export interface FamilyLink {
  id: string;
  patient_id: string;
  family_user_id: string;
  relationship: string | null;
  created_at: string;
}

export interface CarePlan {
  id: string;
  agency_id: string;
  patient_id: string;
  title: string;
  active: boolean;
  created_at: string;
}

export interface CareTask {
  id: string;
  care_plan_id: string;
  label: string;
  category: TaskCategory;
  instructions: string | null;
  sort_order: number;
  created_at: string;
}

export interface Shift {
  id: string;
  agency_id: string;
  patient_id: string;
  nurse_id: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  created_at: string;
}

export interface Visit {
  id: string;
  agency_id: string;
  shift_id: string;
  patient_id: string;
  nurse_id: string;
  check_in_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_flagged: boolean;
  check_in_distance_m: number | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  status: VisitStatus;
  created_at: string;
}

export interface VisitTask {
  id: string;
  visit_id: string;
  care_task_id: string;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
}

export interface Vitals {
  id: string;
  visit_id: string;
  patient_id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  glucose: number | null;
  temperature: number | null;
  pain_level: number | null;
  mood: string | null;
  recorded_at: string;
}

export interface VisitNote {
  id: string;
  visit_id: string;
  summary: string;
  body: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  visit_id: string;
  patient_id: string;
  storage_path: string;
  category: string | null;
  caption: string | null;
  created_at: string;
}

export interface Incident {
  id: string;
  agency_id: string;
  patient_id: string;
  nurse_id: string;
  visit_id: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  created_at: string;
}

export interface Message {
  id: string;
  agency_id: string;
  patient_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  agency_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Minimal Database type satisfying the supabase-js generic client.
// Loosely typed on purpose — call sites use the domain interfaces above
// for real type safety after `.select()`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
