-- Peace-of-mind rebuild. Additive migration (no drops) that turns the lean
-- clock-in/report model into the family-facing "is Mom okay?" product:
-- a per-visit care checklist, mood, pain, concern flag, and one photo on
-- the caregiver side; caregiver profiles + agency phone for the family's
-- "call" buttons; a lightweight next-visit time per patient for the
-- status card / late / missed logic; and a granular timeline built on the
-- existing patient_updates table.

-- ============================================================================
-- TIMELINE EVENT TYPES (extend update_type)
-- ============================================================================
-- New values aren't referenced by literal anywhere else in this script, so
-- adding them here is transaction-safe.
alter type update_type add value if not exists 'arrived';
alter type update_type add value if not exists 'task';
alter type update_type add value if not exists 'concern';
alter type update_type add value if not exists 'completed';
alter type update_type add value if not exists 'visit_photo';

-- ============================================================================
-- AGENCIES: phone for the family "call the agency" button
-- ============================================================================
alter table agencies add column if not exists phone text;

-- ============================================================================
-- USERS: caregiver profile (families like knowing who's there)
-- ============================================================================
alter table users add column if not exists photo_url text;
alter table users add column if not exists years_experience int;
alter table users add column if not exists bio text;

-- ============================================================================
-- PATIENTS: a single upcoming expected visit time (not a full scheduler).
-- Drives "next scheduled visit", "running late", and "missed" states.
-- ============================================================================
alter table patients add column if not exists next_visit_at timestamptz;

-- ============================================================================
-- VISITS: care checklist + mood + pain + concern + one optional photo.
-- (The existing `report` column is the caregiver's written note.)
-- ============================================================================
alter table visits add column if not exists ate_breakfast boolean not null default false;
alter table visits add column if not exists ate_lunch boolean not null default false;
alter table visits add column if not exists ate_dinner boolean not null default false;
alter table visits add column if not exists medication_given boolean not null default false;
alter table visits add column if not exists showered boolean not null default false;
alter table visits add column if not exists walked boolean not null default false;
alter table visits add column if not exists drank_water boolean not null default false;
alter table visits add column if not exists bathroom_assisted boolean not null default false;
alter table visits add column if not exists mood text;
alter table visits add column if not exists pain_level int;
alter table visits add column if not exists concern_flag boolean not null default false;
alter table visits add column if not exists concern_text text;
alter table visits add column if not exists photo_path text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'visits_mood_check') then
    alter table visits add constraint visits_mood_check
      check (mood is null or mood in ('great', 'good', 'okay', 'unwell'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visits_pain_check') then
    alter table visits add constraint visits_pain_check
      check (pain_level is null or (pain_level between 0 and 10));
  end if;
end $$;

-- ============================================================================
-- RLS: let caregivers write any non-family timeline event (arrived, task,
-- concern, completed, visit_photo, shift_report) for their patient. Uses a
-- negative match so no new enum literal is referenced here.
-- ============================================================================
drop policy if exists patient_updates_caregiver_insert on patient_updates;
create policy patient_updates_caregiver_insert on patient_updates for insert
  with check (
    author_id = auth.uid()
    and agency_id = auth_agency_id()
    and type not in ('family_photo', 'family_note')
    and is_caregiver_for_patient(patient_id)
  );

-- Allow caregivers to delete their own timeline events (e.g. un-checking a
-- checklist item removes the matching "task" event).
drop policy if exists patient_updates_caregiver_delete on patient_updates;
create policy patient_updates_caregiver_delete on patient_updates for delete
  using (author_id = auth.uid() and is_caregiver_for_patient(patient_id));
