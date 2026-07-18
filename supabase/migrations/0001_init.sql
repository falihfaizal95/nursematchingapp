-- Home Care Coordination Platform — initial schema
-- Multi-tenant via agency_id on every table. RLS enforced everywhere.

create extension if not exists "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================
create type user_role as enum ('admin', 'nurse', 'family');
create type shift_status as enum ('scheduled', 'checked_in', 'completed', 'missed', 'cancelled');
create type visit_status as enum ('in_progress', 'completed', 'flagged');
create type task_category as enum ('medication', 'wound_care', 'bathing', 'meals', 'mobility', 'vitals', 'other');
create type incident_type as enum ('fall', 'refusal', 'medication_error', 'concern', 'other');
create type incident_severity as enum ('low', 'medium', 'high', 'critical');
create type incident_status as enum ('open', 'reviewed', 'resolved');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

create table agencies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Mirrors auth.users, adds role + agency + profile fields.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  agency_id uuid not null references agencies (id) on delete cascade,
  role user_role not null,
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  primary_condition text,
  allergies text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Join table: which family users can see which patients.
create table family_links (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients (id) on delete cascade,
  family_user_id uuid not null references users (id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique (patient_id, family_user_id)
);

create table care_plans (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table care_tasks (
  id uuid primary key default uuid_generate_v4(),
  care_plan_id uuid not null references care_plans (id) on delete cascade,
  label text not null,
  category task_category not null default 'other',
  instructions text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table shifts (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  nurse_id uuid not null references users (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status shift_status not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table visits (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  shift_id uuid not null references shifts (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  nurse_id uuid not null references users (id) on delete cascade,
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_flagged boolean not null default false,
  check_in_distance_m double precision,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  status visit_status not null default 'in_progress',
  created_at timestamptz not null default now()
);

create table visit_tasks (
  id uuid primary key default uuid_generate_v4(),
  visit_id uuid not null references visits (id) on delete cascade,
  care_task_id uuid not null references care_tasks (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  notes text
);

create table vitals (
  id uuid primary key default uuid_generate_v4(),
  visit_id uuid not null references visits (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  bp_systolic int,
  bp_diastolic int,
  heart_rate int,
  glucose int,
  temperature numeric(4,1),
  pain_level int check (pain_level between 0 and 10),
  mood text,
  recorded_at timestamptz not null default now()
);

create table visit_notes (
  id uuid primary key default uuid_generate_v4(),
  visit_id uuid not null references visits (id) on delete cascade,
  summary text not null,
  body text,
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default uuid_generate_v4(),
  visit_id uuid not null references visits (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  storage_path text not null,
  category text,
  caption text,
  created_at timestamptz not null default now()
);

create table incidents (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  nurse_id uuid not null references users (id) on delete cascade,
  visit_id uuid references visits (id) on delete set null,
  type incident_type not null,
  severity incident_severity not null default 'medium',
  description text not null,
  status incident_status not null default 'open',
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  sender_id uuid not null references users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index on users (agency_id);
create index on patients (agency_id);
create index on family_links (family_user_id);
create index on family_links (patient_id);
create index on care_plans (patient_id);
create index on care_tasks (care_plan_id);
create index on shifts (agency_id, start_time);
create index on shifts (nurse_id);
create index on shifts (patient_id);
create index on visits (shift_id);
create index on visits (patient_id);
create index on visits (nurse_id);
create index on visit_tasks (visit_id);
create index on vitals (patient_id, recorded_at);
create index on visit_notes (visit_id);
create index on photos (patient_id);
create index on incidents (agency_id, status);
create index on messages (patient_id, created_at);
create index on audit_log (agency_id, created_at);

-- ============================================================================
-- HELPER FUNCTIONS (security definer, used inside RLS policies)
-- ============================================================================

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid();
$$;

create or replace function auth_agency_id() returns uuid
language sql stable security definer set search_path = public as $$
  select agency_id from users where id = auth.uid();
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from users where id = auth.uid()), false);
$$;

create or replace function is_nurse_for_patient(p_patient_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from shifts
    where patient_id = p_patient_id and nurse_id = auth.uid()
  );
$$;

create or replace function is_family_for_patient(p_patient_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_links
    where patient_id = p_patient_id and family_user_id = auth.uid()
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table agencies enable row level security;
alter table users enable row level security;
alter table patients enable row level security;
alter table family_links enable row level security;
alter table care_plans enable row level security;
alter table care_tasks enable row level security;
alter table shifts enable row level security;
alter table visits enable row level security;
alter table visit_tasks enable row level security;
alter table vitals enable row level security;
alter table visit_notes enable row level security;
alter table photos enable row level security;
alter table incidents enable row level security;
alter table messages enable row level security;
alter table audit_log enable row level security;

-- agencies: readable by members of that agency only
create policy agencies_select on agencies for select
  using (id = auth_agency_id());

-- users: everyone can see co-workers/family in same agency (needed for names on visits/messages); only admin manages
create policy users_select on users for select
  using (agency_id = auth_agency_id());
create policy users_insert_admin on users for insert
  with check (is_admin() and agency_id = auth_agency_id());
create policy users_update_admin on users for update
  using (is_admin() and agency_id = auth_agency_id());

-- patients: admin full access; nurse read-only for assigned patients; family read-only for linked patients
create policy patients_select on patients for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or is_nurse_for_patient(id) or is_family_for_patient(id))
  );
create policy patients_admin_write on patients for all
  using (is_admin() and agency_id = auth_agency_id())
  with check (is_admin() and agency_id = auth_agency_id());

-- family_links: admin manages; family can see their own link; nurse can see for their patients
create policy family_links_select on family_links for select
  using (
    family_user_id = auth.uid()
    or is_admin()
    or is_nurse_for_patient(patient_id)
  );
create policy family_links_admin_write on family_links for all
  using (is_admin())
  with check (is_admin());

-- care_plans / care_tasks: admin writes; nurse + family read for their patients
create policy care_plans_select on care_plans for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or is_nurse_for_patient(patient_id) or is_family_for_patient(patient_id))
  );
create policy care_plans_admin_write on care_plans for all
  using (is_admin() and agency_id = auth_agency_id())
  with check (is_admin() and agency_id = auth_agency_id());

create policy care_tasks_select on care_tasks for select
  using (
    exists (
      select 1 from care_plans cp
      where cp.id = care_plan_id
      and (is_admin() or is_nurse_for_patient(cp.patient_id) or is_family_for_patient(cp.patient_id))
      and cp.agency_id = auth_agency_id()
    )
  );
create policy care_tasks_admin_write on care_tasks for all
  using (
    exists (select 1 from care_plans cp where cp.id = care_plan_id and cp.agency_id = auth_agency_id())
    and is_admin()
  )
  with check (
    exists (select 1 from care_plans cp where cp.id = care_plan_id and cp.agency_id = auth_agency_id())
    and is_admin()
  );

-- shifts: admin full access; nurse reads own; family reads their patient's
create policy shifts_select on shifts for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or nurse_id = auth.uid() or is_family_for_patient(patient_id))
  );
create policy shifts_admin_write on shifts for all
  using (is_admin() and agency_id = auth_agency_id())
  with check (is_admin() and agency_id = auth_agency_id());
create policy shifts_nurse_update on shifts for update
  using (nurse_id = auth.uid() and agency_id = auth_agency_id())
  with check (nurse_id = auth.uid() and agency_id = auth_agency_id());

-- visits: nurse creates/updates own visits; admin full read/write; family read-only for their patient
create policy visits_select on visits for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or nurse_id = auth.uid() or is_family_for_patient(patient_id))
  );
create policy visits_nurse_insert on visits for insert
  with check (nurse_id = auth.uid() and agency_id = auth_agency_id());
create policy visits_nurse_update on visits for update
  using (nurse_id = auth.uid() and agency_id = auth_agency_id())
  with check (nurse_id = auth.uid() and agency_id = auth_agency_id());
create policy visits_admin_write on visits for all
  using (is_admin() and agency_id = auth_agency_id())
  with check (is_admin() and agency_id = auth_agency_id());

-- visit_tasks: follows parent visit's access; nurse can write for own visit
create policy visit_tasks_select on visit_tasks for select
  using (
    exists (
      select 1 from visits v where v.id = visit_id
      and (is_admin() or v.nurse_id = auth.uid() or is_family_for_patient(v.patient_id))
      and v.agency_id = auth_agency_id()
    )
  );
create policy visit_tasks_nurse_write on visit_tasks for all
  using (exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid()))
  with check (exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid()));
create policy visit_tasks_admin_write on visit_tasks for all
  using (exists (select 1 from visits v where v.id = visit_id and v.agency_id = auth_agency_id() and is_admin()))
  with check (exists (select 1 from visits v where v.id = visit_id and v.agency_id = auth_agency_id() and is_admin()));

-- vitals: nurse writes for own visit; admin + family read
create policy vitals_select on vitals for select
  using (
    is_admin()
    or is_family_for_patient(patient_id)
    or exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid())
  );
create policy vitals_nurse_write on vitals for insert
  with check (exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid()));
create policy vitals_nurse_update on vitals for update
  using (exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid()));
create policy vitals_admin_write on vitals for all
  using (is_admin()) with check (is_admin());

-- visit_notes: same pattern as vitals
create policy visit_notes_select on visit_notes for select
  using (
    is_admin()
    or exists (select 1 from visits v where v.id = visit_id and (v.nurse_id = auth.uid() or is_family_for_patient(v.patient_id)))
  );
create policy visit_notes_nurse_write on visit_notes for insert
  with check (exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid()));
create policy visit_notes_nurse_update on visit_notes for update
  using (exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid()));
create policy visit_notes_admin_write on visit_notes for all
  using (is_admin()) with check (is_admin());

-- photos: same pattern
create policy photos_select on photos for select
  using (
    is_admin()
    or is_family_for_patient(patient_id)
    or exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid())
  );
create policy photos_nurse_write on photos for insert
  with check (exists (select 1 from visits v where v.id = visit_id and v.nurse_id = auth.uid()));
create policy photos_admin_write on photos for all
  using (is_admin()) with check (is_admin());

-- incidents: nurse creates own; admin full; family read-only for their patient
create policy incidents_select on incidents for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or nurse_id = auth.uid() or is_family_for_patient(patient_id))
  );
create policy incidents_nurse_insert on incidents for insert
  with check (nurse_id = auth.uid() and agency_id = auth_agency_id());
create policy incidents_admin_write on incidents for all
  using (is_admin() and agency_id = auth_agency_id())
  with check (is_admin() and agency_id = auth_agency_id());

-- messages: family + admin can read/write for a given patient thread; nurse read-only
create policy messages_select on messages for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or is_family_for_patient(patient_id) or is_nurse_for_patient(patient_id))
  );
create policy messages_write on messages for insert
  with check (
    agency_id = auth_agency_id()
    and sender_id = auth.uid()
    and (is_admin() or is_family_for_patient(patient_id))
  );

-- audit_log: admin only read; any authenticated user in agency can insert their own row (app-controlled)
create policy audit_log_select_admin on audit_log for select
  using (is_admin() and agency_id = auth_agency_id());
create policy audit_log_insert on audit_log for insert
  with check (agency_id = auth_agency_id() and (user_id = auth.uid() or user_id is null));

-- ============================================================================
-- STORAGE (private bucket for visit photos)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

create policy "visit_photos_read" on storage.objects for select
  using (
    bucket_id = 'visit-photos'
    and (
      is_admin()
      or exists (
        select 1 from photos p
        join visits v on v.id = p.visit_id
        where p.storage_path = storage.objects.name
        and (v.nurse_id = auth.uid() or is_family_for_patient(v.patient_id))
      )
    )
  );

create policy "visit_photos_write" on storage.objects for insert
  with check (bucket_id = 'visit-photos' and auth.role() = 'authenticated');
