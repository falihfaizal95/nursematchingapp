# Harbor Home Care

A home care coordination platform. A private home care agency places
nurses/caregivers with patients in their homes; the agency bills families
hourly and pays caregivers, keeping the spread. This repo is the agency's
operating system: real-time visibility for families, a fast one-handed
tool for nurses in the field, and a live operations dashboard for the
agency.

This is a monorepo with **two clients sharing one Supabase backend**:

```
supabase/       Postgres schema + RLS policies + the invite-user Edge Function
scripts/        seed.ts — one shared demo-data script for both apps
mobile/         Expo (React Native) app — install on a phone, iOS/Android
web/            Next.js app — installable as a PWA, or just used in a browser
```

Same tables, same RLS policies, same rules about who can see what — a
nurse, family member, or admin gets an equivalent experience whichever
client they're on. Pick whichever fits how you want to ship: `mobile/` if
you want App Store / Play Store presence and the best on-device GPS/camera
experience; `web/` if you want something you can ship today with a link,
no store review, installable to a home screen as a PWA.

- **Nurse** — today's schedule, GPS-verified check-in, care-plan checklist,
  vitals, structured visit notes, camera photos, GPS check-out, and an
  incident report form that flags admin immediately.
- **Family** — latest visit summary, vitals trend charts, photo timeline,
  upcoming visit calendar, a weekly "care score," and a message thread with
  the agency. Read-only except for messaging.
- **Admin** — patients, care plans, nurses, scheduling, a live board of
  today's visits (scheduled / checked-in / completed / missed), incident
  review, family invites, and hours-delivered reporting.

## Setup

### 1. Supabase project (shared by both apps)

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   in the SQL Editor — creates every table, `agency_id`-scoped RLS
   policies, and the private `visit-photos` storage bucket.
3. Deploy the invite function (needed for the mobile app's admin-invite
   flow — see [Inviting nurses and family](#inviting-nurses-and-family-members) below):
   ```bash
   npx supabase functions deploy invite-user
   ```
   No manual secrets needed — the platform provides `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` to every Edge Function automatically.

### 2. Seed demo data (once, from the repo root)

```bash
cp .env.example .env.local   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run seed
```

Creates one agency, one admin, three nurses, four patients with realistic
care plans, two family accounts, and two weeks of completed visits with
vitals. Prints the demo login for all seeded accounts.

### 3. Run the mobile app

```bash
cd mobile
cp .env.example .env.local   # fill in EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` for a
simulator. For a real installable build, see
[Building a real installable app](#building-a-real-installable-mobile-app) below.

### 4. Run the web app

```bash
cd web
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Open `http://localhost:3000`. On a phone, "Add to Home Screen" installs it
as a standalone PWA (`web/public/manifest.json`).

## Inviting nurses and family members

Each app handles this the way that fits its own hosting model — same
tables (`users`, `family_links`), same audit trail, different transport:

- **Web** ([`web/src/lib/actions/admin-people.ts`](web/src/lib/actions/admin-people.ts)) —
  a Next.js server action calls `supabase.auth.admin.inviteUserByEmail`,
  which sends a real email with a magic link back to `/auth/callback` on
  the deployed site. This is the nicer flow, and web has a real URL to
  link back to.
- **Mobile** ([`supabase/functions/invite-user`](supabase/functions/invite-user)) —
  there's no website to deep-link back to, so the Edge Function creates
  the account with a random temporary password and returns it once. The
  admin shares it directly (text, call, in person); the new nurse/family
  member signs in and sets a real password from their profile screen.

Both are admin-only, both write the same `users` row and `audit_log`
entry, both are safe to use interchangeably — an admin using the web app
can invite someone who then only ever uses the mobile app, and vice versa.

## Building a real installable mobile app

Expo Go covers development. For a real device install or store
submission, use EAS from inside `mobile/`:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile preview --platform ios      # or android
```

Set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS
project environment variables (`eas env:create`) so they're present at
build time. See [Expo's EAS Build docs](https://docs.expo.dev/build/introduction/)
for store submission (`eas submit`).

## Deploying the web app

Any Node host works; Vercel is the zero-config option:

```bash
cd web && vercel deploy
```

Set the same environment variables from `web/.env.local` in the hosting
provider, plus `NEXT_PUBLIC_SITE_URL` set to the real deployed URL (used to
build the invite-email redirect link).

## Data model

`agencies → users (role: admin/nurse/family) → patients → care_plans →
care_tasks`, and per visit: `shifts → visits → visit_tasks, vitals,
visit_notes, photos`. `incidents` and `messages` hang off `patients`.
Every table carries `agency_id`; every read/write is scoped by Supabase RLS
policies in the migration (nurses see only their assigned patients,
families see only their linked patient, admins see their whole agency) —
enforced at the database layer, so it holds no matter which client is
reading or writing.

`family_links` is a join table (family user ↔ patient) so a family member
can in principle follow more than one patient — both apps' patient
switchers handle that case.

Live-board status (scheduled / checked-in / completed / **missed**) is
derived on read rather than stored — a shift is "missed" once its start
time + 15 minutes has passed with no check-in
(`mobile/src/lib/shift-status.ts` / `web/src/lib/shift-status.ts`, kept in
sync by hand since the two apps don't share a package). See the production
note below on why this needs a scheduled job.

## HIPAA-minded, at MVP level

This is a starting point, not a compliance certification. What's already in place:

- Every PHI-bearing table has RLS enabled; there is no anonymous read path.
- Photos live in a **private** Supabase Storage bucket; both clients only
  ever get short-lived signed URLs, never public paths.
- `audit_log` records who did what to which entity and when — called from
  check-in/out, incident creation, and invites in both apps. Extend this
  to every PHI read if you need full access accountability.
- No PHI appears in URLs, the mobile app's invite flow, or client logs.
- Neither app handles raw passwords beyond what's necessary — Supabase
  Auth owns credential storage and hashing.

**What a real production deployment still needs:**

- A signed **BAA (Business Associate Agreement)** with Supabase (and
  whatever host runs `web/`) before any real patient data touches this
  system.
- Encryption at rest — confirm it's enabled on your Supabase project tier.
- Session timeouts / idle logout, especially on shared family devices.
- A scheduled job (Supabase `pg_cron` + a Postgres function, or a
  scheduled Edge Function) that proactively checks for missed visits and
  open incidents and pushes a notification — today that logic only runs
  when someone has a client open on the live board.
- Push notifications in general — not implemented in this MVP. Mobile
  would use `expo-notifications`; web would use the Web Push API. Both
  would hang off the same Edge Function trigger.
- Tightening the `visit-photos` storage write policy, which currently
  allows any authenticated user to upload to any path in the bucket
  (visibility is still correctly restricted by the `photos` table RLS
  policies, but the write path itself isn't yet scoped to "nurse's own
  visit").
- Real geocoding on patient address entry (admin currently enters lat/lng
  by hand) and a device-spoofing–resistant location check for GPS
  check-in.
- Rate limiting on auth and message endpoints, and a documented data
  retention / deletion policy.

## What's intentionally out of scope for this MVP

- Billing / invoicing (the reports screen computes hours delivered — the
  input to billing and payroll — but doesn't generate invoices or run
  payroll).
- Recurring shift edits/deletes as a series (cancelling is per-occurrence).
- Push notifications for missed visits / incidents (see the note above).
- Care plan templates library — each patient's care plan is authored from
  scratch today.
- Offline support — every screen assumes a network connection to Supabase.
- A shared TypeScript package for the code duplicated between `mobile/`
  and `web/` (types, RLS-shaped query logic, care-score math). Fine at
  this size; worth factoring out into a shared package if both clients
  keep growing.
