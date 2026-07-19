-- Family-first rebuild. Replaces the original multi-patient/scheduling
-- model with a lean one: each caregiver is assigned to exactly one
-- patient, ongoing (no shift scheduling). A caregiver clocks in (starts
-- live location sharing + a transparency notice), clocks out only after
-- submitting an end-of-day report, and the family sees a live map while
-- active plus a shared timeline (caregiver reports + family's own photo
-- updates). Admin is reduced to setup: patients, caregiver assignment,
-- family invites.
--
-- This DROPS the previous schema (care_plans, care_tasks, shifts,
-- visit_tasks, vitals, visit_notes, incidents, messages, and the old
-- shape of patients/users/visits). Demo data will be wiped — re-run
-- scripts/seed.ts after applying this.

-- ============================================================================
-- DROP OLD SCHEMA
-- ============================================================================
drop table if exists messages cascade;
drop table if exists incidents cascade;
drop table if exists photos cascade;
drop table if exists visit_notes cascade;
drop table if exists vitals cascade;
drop table if exists visit_tasks cascade;
drop table if exists care_tasks cascade;
drop table if exists care_plans cascade;
drop table if exists visits cascade;
drop table if exists shifts cascade;
drop table if exists family_links cascade;
drop table if exists patients cascade;
drop table if exists audit_log cascade;
drop table if exists users cascade;
drop table if exists agencies cascade;

drop function if exists auth_role();
drop function if exists auth_agency_id();
drop function if exists is_admin();
drop function if exists is_nurse_for_patient(uuid);
drop function if exists is_family_for_patient(uuid);

drop type if exists user_role cascade;
drop type if exists shift_status cascade;
drop type if exists visit_status cascade;
drop type if exists task_category cascade;
drop type if exists incident_type cascade;
drop type if exists incident_severity cascade;
drop type if exists incident_status cascade;

drop policy if exists "visit_photos_read" on storage.objects;
drop policy if exists "visit_photos_write" on storage.objects;

-- ============================================================================
-- ENUMS
-- ============================================================================
create type user_role as enum ('admin', 'caregiver', 'family');
create type visit_status as enum ('active', 'completed');
create type update_type as enum ('shift_report', 'family_photo', 'family_note');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

create table agencies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

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
  caregiver_id uuid references users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Join table: which family users can see which patients (usually one, but
-- more than one relative can watch the same patient).
create table family_links (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients (id) on delete cascade,
  family_user_id uuid not null references users (id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique (patient_id, family_user_id)
);

-- One row per clock-in/clock-out session. No scheduling — the caregiver
-- just clocks in when they arrive. current_lat/current_lng is overwritten
-- (not appended) while active, so no location trail persists once the
-- caregiver clocks out — only the fact that a shift happened.
create table visits (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  caregiver_id uuid not null references users (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_in_lat double precision not null,
  clock_in_lng double precision not null,
  clock_in_flagged boolean not null default false,
  clock_in_distance_m double precision,
  current_lat double precision,
  current_lng double precision,
  location_updated_at timestamptz,
  clock_out_at timestamptz,
  clock_out_lat double precision,
  clock_out_lng double precision,
  report text,
  status visit_status not null default 'active',
  created_at timestamptz not null default now()
);

-- The shared timeline: caregiver end-of-day reports and family-uploaded
-- photos/notes, all in one feed per patient.
create table patient_updates (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references agencies (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  visit_id uuid references visits (id) on delete set null,
  author_id uuid not null references users (id) on delete cascade,
  type update_type not null,
  body text,
  photo_path text,
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
create index on patients (caregiver_id);
create index on family_links (family_user_id);
create index on family_links (patient_id);
create index on visits (patient_id, clock_in_at);
create index on visits (caregiver_id);
create index on visits (status);
create index on patient_updates (patient_id, created_at);
create index on audit_log (agency_id, created_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

create or replace function auth_agency_id() returns uuid
language sql stable security definer set search_path = public as $$
  select agency_id from users where id = auth.uid();
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from users where id = auth.uid()), false);
$$;

create or replace function is_caregiver_for_patient(p_patient_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from patients where id = p_patient_id and caregiver_id = auth.uid()
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
alter table visits enable row level security;
alter table patient_updates enable row level security;
alter table audit_log enable row level security;

create policy agencies_select on agencies for select
  using (id = auth_agency_id());

create policy users_select on users for select
  using (agency_id = auth_agency_id());
create policy users_insert_admin on users for insert
  with check (is_admin() and agency_id = auth_agency_id());
create policy users_update_admin on users for update
  using (is_admin() and agency_id = auth_agency_id());

create policy patients_select on patients for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or caregiver_id = auth.uid() or is_family_for_patient(id))
  );
create policy patients_admin_write on patients for all
  using (is_admin() and agency_id = auth_agency_id())
  with check (is_admin() and agency_id = auth_agency_id());

create policy family_links_select on family_links for select
  using (family_user_id = auth.uid() or is_admin() or is_caregiver_for_patient(patient_id));
create policy family_links_admin_write on family_links for all
  using (is_admin())
  with check (is_admin());

create policy visits_select on visits for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or caregiver_id = auth.uid() or is_family_for_patient(patient_id))
  );
create policy visits_caregiver_insert on visits for insert
  with check (
    caregiver_id = auth.uid()
    and agency_id = auth_agency_id()
    and is_caregiver_for_patient(patient_id)
  );
create policy visits_caregiver_update on visits for update
  using (caregiver_id = auth.uid() and agency_id = auth_agency_id())
  with check (caregiver_id = auth.uid() and agency_id = auth_agency_id());
create policy visits_admin_write on visits for all
  using (is_admin() and agency_id = auth_agency_id())
  with check (is_admin() and agency_id = auth_agency_id());

create policy patient_updates_select on patient_updates for select
  using (
    agency_id = auth_agency_id()
    and (is_admin() or is_caregiver_for_patient(patient_id) or is_family_for_patient(patient_id))
  );
create policy patient_updates_caregiver_insert on patient_updates for insert
  with check (
    author_id = auth.uid()
    and agency_id = auth_agency_id()
    and type = 'shift_report'
    and is_caregiver_for_patient(patient_id)
  );
create policy patient_updates_family_insert on patient_updates for insert
  with check (
    author_id = auth.uid()
    and agency_id = auth_agency_id()
    and type in ('family_photo', 'family_note')
    and is_family_for_patient(patient_id)
  );
create policy patient_updates_admin_write on patient_updates for all
  using (is_admin() and agency_id = auth_agency_id())
  with check (is_admin() and agency_id = auth_agency_id());

create policy audit_log_select_admin on audit_log for select
  using (is_admin() and agency_id = auth_agency_id());
create policy audit_log_insert on audit_log for insert
  with check (agency_id = auth_agency_id() and (user_id = auth.uid() or user_id is null));

-- ============================================================================
-- STORAGE (private bucket for family/caregiver photo updates)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('patient-photos', 'patient-photos', false)
on conflict (id) do nothing;

-- Path convention: `${patient_id}/${filename}` — access mirrors patients access.
create policy "patient_photos_read" on storage.objects for select
  using (
    bucket_id = 'patient-photos'
    and (
      is_admin()
      or is_caregiver_for_patient((storage.foldername(name))[1]::uuid)
      or is_family_for_patient((storage.foldername(name))[1]::uuid)
    )
  );

create policy "patient_photos_write" on storage.objects for insert
  with check (bucket_id = 'patient-photos' and auth.role() = 'authenticated');

-- ============================================================================
-- REALTIME
-- ============================================================================
-- The family dashboard subscribes to these so the live map pin and the
-- shared timeline update without a page refresh. RLS still applies to
-- realtime changefeeds, so a family member only ever receives events for
-- rows they're already allowed to select.
alter publication supabase_realtime add table visits;
alter publication supabase_realtime add table patient_updates;
