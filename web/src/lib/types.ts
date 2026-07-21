// Hand-maintained types mirroring supabase/migrations/0002 + 0003.

export type UserRole = "admin" | "caregiver" | "family";
export type VisitStatus = "active" | "completed";
export type UpdateType =
  | "shift_report"
  | "family_photo"
  | "family_note"
  | "arrived"
  | "task"
  | "concern"
  | "completed"
  | "visit_photo";
export type Mood = "great" | "good" | "okay" | "unwell";

export interface Agency {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  agency_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  years_experience: number | null;
  bio: string | null;
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
  caregiver_id: string | null;
  next_visit_at: string | null;
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

export interface Visit {
  id: string;
  agency_id: string;
  patient_id: string;
  caregiver_id: string;
  clock_in_at: string;
  clock_in_lat: number;
  clock_in_lng: number;
  clock_in_flagged: boolean;
  clock_in_distance_m: number | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  clock_out_at: string | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  report: string | null;
  ate_breakfast: boolean;
  ate_lunch: boolean;
  ate_dinner: boolean;
  medication_given: boolean;
  showered: boolean;
  walked: boolean;
  drank_water: boolean;
  bathroom_assisted: boolean;
  mood: Mood | null;
  pain_level: number | null;
  concern_flag: boolean;
  concern_text: string | null;
  photo_path: string | null;
  status: VisitStatus;
  created_at: string;
}

// The set of checklist booleans on a visit, with display labels. Keeping
// this list in one place keeps the caregiver checklist, the family care
// summary, and the timeline in sync.
export const CARE_TASKS = [
  { field: "medication_given", label: "Medication given" },
  { field: "ate_breakfast", label: "Ate breakfast" },
  { field: "ate_lunch", label: "Ate lunch" },
  { field: "ate_dinner", label: "Ate dinner" },
  { field: "drank_water", label: "Drank enough water" },
  { field: "showered", label: "Showered / bathed" },
  { field: "walked", label: "Walked / active" },
  { field: "bathroom_assisted", label: "Assisted with bathroom" },
] as const;

export type CareTaskField = (typeof CARE_TASKS)[number]["field"];

export interface PatientUpdate {
  id: string;
  agency_id: string;
  patient_id: string;
  visit_id: string | null;
  author_id: string;
  type: UpdateType;
  body: string | null;
  photo_path: string | null;
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
