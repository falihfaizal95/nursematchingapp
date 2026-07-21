# Harbor Home Care

A **peace-of-mind app for families with a loved one in home care.** It is
not workforce software — every screen exists to answer the three questions
a son or daughter has when they check on a parent:

1. **Did the caregiver actually show up?**
2. **Is everything okay?**
3. **What happened today?**

A caregiver is assigned to one patient. On shift they GPS clock-in, work
through a care checklist (meds, meals, water, bathing, walk, bathroom), set
a mood, note a pain level, write a note, add one optional photo, and can
flag a concern — then clock out. The family sees a big **status card**
(arrived / on-site with a live map / complete / running late / no check-in),
a **Peace of Mind summary** (arrived ✓, medication ✓, meals ✓, mood, no
concerns), the caregiver's note and photo, a **caregiver profile with call
buttons**, and a **live timeline** of the visit. Admin sees today's visits,
late/missed check-ins, and flagged concerns.

> **Status:** `web/` reflects this product as of the family-first rebuild.
> `mobile/` (Expo) still targets the *previous*, much broader schema
> (multi-patient scheduling, vitals, care plans, incidents) and will not
> run against the current database until it's rebuilt to match — that
> hasn't happened yet.

```
supabase/       Postgres schema + RLS policies + the invite-user Edge Function
scripts/        seed.ts — shared demo-data script
mobile/         Expo (React Native) app — OUT OF SYNC, see status note above
web/            Next.js app — the current, family-first product
```

## The three roles

- **Family** — the primary user. A status card answers "did they show up?"
  (with a live map while on-site), a Peace of Mind summary answers "is
  everything okay?", and the note + photo + timeline answer "what happened
  today?" — plus the caregiver's profile and one-tap call buttons for the
  caregiver or the agency, and the next scheduled visit.
- **Caregiver** — assigned to one patient. GPS clock-in, a care checklist
  (each item checked drops a timestamped entry on the family's timeline),
  mood, pain, a written note, one optional photo, a flag-a-concern button,
  and clock-out.
- **Admin** — today's visits (on-shift now / completed), late & missed
  check-in alerts, flagged concerns to review, caregiver profiles, family
  invites, and each patient's next scheduled visit.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Run these migrations in the SQL Editor, **in order**:
   [`0001_init.sql`](supabase/migrations/0001_init.sql) →
   [`0002_family_first_rebuild.sql`](supabase/migrations/0002_family_first_rebuild.sql) →
   [`0003_peace_of_mind.sql`](supabase/migrations/0003_peace_of_mind.sql).
   0002 replaces 0001's broad schema; 0003 is additive (care checklist,
   mood, pain, concern, caregiver profiles, agency phone, next-visit time,
   and the timeline event types). Re-seed after running them.
3. Deploy the invite function (used by `mobile/`, once it's rebuilt to
   match; harmless to deploy now regardless):
   ```bash
   npx supabase functions deploy invite-user
   ```

### 2. Seed demo data (once, from the repo root)

```bash
cp .env.example .env.local   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run seed
```

Creates one agency, one admin, three caregivers each assigned to one
patient (a fourth patient is left unassigned on purpose, to show that
state in the admin UI), two family accounts, ~10 days of completed visits
with end-of-day reports, and one **currently active** visit so the live
map has something to show the moment you sign in. The script is safe to
re-run — it clears out its own `@harborcare.demo` accounts first. Prints
the shared demo password at the end.

### 3. Run the web app

```bash
cd web
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Open `http://localhost:3000`. On a phone, "Add to Home Screen" installs
it as a standalone PWA.

## The caregiver flow

1. Clock in (one tap; requests location once) → starts sharing live
   location with family, no scheduling/expected-time check in this MVP.
2. Nothing else is required during the shift — no checklist, no vitals.
3. Before clock-out is allowed, they submit a free-text **end-of-day
   report** — this becomes a `shift_report` entry on the patient's shared
   timeline.
4. Clock out → location sharing stops immediately. `current_lat`/`lng` is
   cleared, not archived — no location trail persists after the shift.

## The family flow

- A live map (OpenStreetMap embed, no API key needed) shows the
  caregiver's current position while a visit is active, updated in real
  time via a Supabase Realtime subscription — no page refresh needed.
- A shared timeline per patient: caregiver end-of-day reports and the
  family's own photo/note updates, newest first, also live via Realtime.
- Family can post a photo + caption (or just a note) to that timeline at
  any time — not tied to a caregiver visit.

## Deploying the web app

Any Node host works; Vercel is the zero-config option:

```bash
cd web && vercel deploy
```

Set the same environment variables from `web/.env.local` in the hosting
provider, plus `NEXT_PUBLIC_SITE_URL` set to the real deployed URL (used to
build the invite-email redirect link).

## Data model

`agencies → users (role: admin/caregiver/family) → patients
(caregiver_id — one assigned caregiver) → visits (clock-in/out, live
location, end-of-day report) → patient_updates (the shared timeline:
caregiver shift reports + family photos/notes)`. `family_links` connects
family users to the patient(s) they can see. Every table carries
`agency_id`; every read/write is scoped by RLS policies in the migration,
enforced at the database layer.

`visits.current_lat`/`current_lng` is **overwritten**, not appended, while
a visit is active, and cleared on clock-out — there's no stored location
trail, only the fact that a shift happened and what was reported. `visits`
and `patient_updates` are both added to the `supabase_realtime` publication
so the family dashboard's live map and timeline update without polling.

## HIPAA-minded, at MVP level

This is a starting point, not a compliance certification. What's already in place:

- Every PHI-bearing table has RLS enabled; there is no anonymous read path.
- Photos live in a **private** Supabase Storage bucket (`patient-photos`);
  the app only ever gets short-lived signed URLs, never public paths.
- `audit_log` records who did what to which entity and when — called from
  clock-in/out and invites. Extend this to every PHI read if you need full
  access accountability.
- No PHI appears in URLs or client logs.
- Live location is ephemeral by design (see above) and only visible to the
  linked family member(s) and admin, per RLS — never public, never stored
  after the shift ends.

**What a real production deployment still needs:**

- A signed **BAA (Business Associate Agreement)** with Supabase (and
  whatever host runs `web/`) before any real patient data touches this
  system.
- Encryption at rest — confirm it's enabled on your Supabase project tier.
- Session timeouts / idle logout, especially on shared family devices.
- Explicit, persistent consent/notice for the caregiver about location
  sharing — the app shows a banner while clocked in, but a real rollout
  should have this as an explicit acknowledgment at hire/onboarding time,
  not just an in-app notice.
- Push notifications (caregiver clocked in, new timeline update) — not
  implemented in this MVP. Would use the Web Push API + a Supabase Edge
  Function trigger.
- Tightening the `patient-photos` storage write policy, which currently
  allows any authenticated user to upload to any path in the bucket
  (visibility is still correctly restricted by RLS on `patient_updates`,
  but the write path itself isn't yet scoped to "your own linked patient").
- Real geocoding on patient address entry (admin currently enters lat/lng
  by hand) and a device-spoofing–resistant location check.
- Rate limiting on auth endpoints, and a documented data retention /
  deletion policy — especially relevant now that live location data flows
  through the system, even if only ephemerally.
- Rebuilding `mobile/` to match this schema, if a native app is still part
  of the roadmap — see the status note at the top.

## What's intentionally out of scope for this MVP

- Shift scheduling — a caregiver just clocks in whenever they arrive, no
  expected time is set or checked. No lateness/no-show detection yet.
- Care-plan checklists, vitals tracking, incident reports, in-app
  messaging, hours/billing reporting — all present in an earlier, broader
  version of this app and deliberately cut for this family-first MVP. Easy
  to reintroduce individually later if a specific one earns its way back in.
- Multiple caregivers per patient, or one caregiver covering multiple
  patients — today's model is strictly 1:1.
- Offline support — every screen assumes a network connection to Supabase.
