// Hand-maintained types mirroring supabase/migrations/0002_family_first_rebuild.sql.

export type UserRole = "admin" | "caregiver" | "family";
export type VisitStatus = "active" | "completed";
export type UpdateType = "shift_report" | "family_photo" | "family_note";

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
  caregiver_id: string | null;
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
  status: VisitStatus;
  created_at: string;
}

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
