# Harbor Home Care

A home care coordination platform, built as a single native app. A private
home care agency places nurses/caregivers with patients in their homes; the
agency bills families hourly and pays caregivers, keeping the spread. This
app is the agency's operating system: real-time visibility for families,
a fast one-handed tool for nurses in the field, and a live operations
dashboard for the agency — all in one Expo (React Native) app with
role-based navigation, backed entirely by Supabase (Postgres, Auth,
Storage, Edge Functions). No separate web app, no separate backend server.

- **Nurse** — today's schedule, GPS-verified check-in, care-plan checklist,
  vitals, structured visit notes, camera photos, GPS check-out, and an
  incident report form that flags admin immediately.
- **Family** — latest visit summary, vitals trend charts, photo timeline,
  upcoming visit calendar, a weekly "care score," and a message thread with
  the agency. Read-only except for messaging.
- **Admin** — patients, care plans, nurses, scheduling, a live board of
  today's visits (scheduled / checked-in / completed / missed), incident
  review, family invites, and hours-delivered reporting.

Which screens you see is decided by your role after sign-in — there's one
app binary, one login screen, one navigation tree per role.

## Stack

Expo (React Native) + TypeScript + `expo-router` for navigation, Supabase
for Postgres/Auth/Storage/Edge Functions. `expo-location` for GPS
check-in/out, `expo-image-picker` for visit photos, `react-native-chart-kit`
for the family vitals charts.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com/dashboard).

2. **Run the schema migration.** In the Supabase SQL Editor, paste and run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates every table, `agency_id`-scoped RLS policies, and the
   private `visit-photos` storage bucket. (If the Supabase CLI is linked to
   the project, `supabase db push` works too.)

3. **Deploy the invite-user Edge Function** (needed for admin to invite
   nurses and family members — it's the one operation that needs the
   service-role key, which never ships inside the app):

   ```bash
   supabase functions deploy invite-user
   ```

   No manual secrets are needed — `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every Edge
   Function by the platform.

4. **Copy environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in from Project Settings → API:
   - `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — these
     are bundled into the app; that's expected, they're safe to ship
     on-device (RLS is what actually protects data, not secrecy of these).
   - `SUPABASE_SERVICE_ROLE_KEY` — used only by `scripts/seed.ts`. Never
     prefix this with `EXPO_PUBLIC_`.

5. **Install and seed:**

   ```bash
   npm install
   npm run seed
   ```

   Creates one agency, one admin, three nurses, four patients with
   realistic care plans, two family accounts, and two weeks of completed
   visits with vitals (so the family charts have data on first run). All
   seeded accounts share the password printed at the end of the script.

6. **Run it:**

   ```bash
   npx expo start
   ```

   Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` for a
   simulator. Sign in — you land on your role's navigation automatically.

## Building a real installable app

Development in Expo Go is enough to build and test everything except
native modules that require a custom dev client. For a real install on a
device or a store submission, use EAS:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile preview --platform ios      # or android
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS
project environment variables (`eas env:create`) so they're present at
build time. See [Expo's EAS Build docs](https://docs.expo.dev/build/introduction/)
for store submission (`eas submit`).

## How admin invites nurses and family members

There's no email/website invite flow — the app is the only surface. When
an admin invites someone from the Nurses or a patient's Family Access
screen, the `invite-user` Edge Function creates their auth account with a
random temporary password and returns it once. The admin shares it with
the new nurse or family member directly (text, call, in person); they sign
in with that email + temp password and are expected to set a real password
from their profile screen. See [`supabase/functions/invite-user`](supabase/functions/invite-user).

## Data model

`agencies → users (role: admin/nurse/family) → patients → care_plans →
care_tasks`, and per visit: `shifts → visits → visit_tasks, vitals,
visit_notes, photos`. `incidents` and `messages` hang off `patients`.
Every table carries `agency_id`; every read/write is scoped by Supabase RLS
policies in the migration (nurses see only their assigned patients,
families see only their linked patient, admins see their whole agency) —
this is enforced at the database layer, so it holds regardless of what the
client does.

`family_links` is a join table (family user ↔ patient) so a family member
can in principle follow more than one patient — the in-app patient switcher
handles that case.

Live-board status (scheduled / checked-in / completed / **missed**) is
derived on read (`src/lib/shift-status.ts`) rather than stored — a shift is
"missed" once its start time + 15 minutes has passed with no check-in. See
the production note below on why this needs a scheduled job.

## HIPAA-minded, at MVP level

This is a starting point, not a compliance certification. What's already in place:

- Every PHI-bearing table has RLS enabled; there is no anonymous read path.
- Photos live in a **private** Supabase Storage bucket; the app only ever
  gets short-lived signed URLs, never public paths.
- `audit_log` records who did what to which entity and when
  (`src/lib/audit.ts`) — called from check-in/out, incident creation, and
  invites. Extend this to every PHI read if you need full access
  accountability.
- No PHI appears in the Supabase Auth invite flow or in client logs.
- Passwords are never handled in plaintext beyond the one-time temporary
  password shown to the admin at invite time — Supabase Auth owns
  credential storage and hashing from then on.

**What a real production deployment still needs:**

- A signed **BAA (Business Associate Agreement)** with Supabase before any
  real patient data touches this system.
- Encryption at rest — confirm it's enabled on your Supabase project tier.
- Session timeouts / idle logout, especially on shared family devices.
- A scheduled job (Supabase's `pg_cron` + a Postgres function, or a
  scheduled Edge Function) that proactively checks for missed visits and
  open incidents and pushes a notification — today that logic runs only
  when someone has the app open on the live board.
- Push notifications in general (missed visit alerts, new incident, new
  message) — not implemented in this MVP; would use `expo-notifications` +
  a Supabase Edge Function trigger.
- Tightening the `visit-photos` storage write policy, which currently
  allows any authenticated user to upload to any path in the bucket
  (visibility is still correctly restricted by the `photos` table RLS
  policies, but the write path itself isn't yet scoped to "nurse's own
  visit").
- Real geocoding on patient address entry (admin currently enters lat/lng
  by hand) and a device-spoofing–resistant location check for GPS
  check-in.
- Rate limiting on auth and message endpoints (Supabase Auth has basic
  rate limits by default — review them for your expected volume), and a
  documented data retention / deletion policy.
- Replacing the temporary-password invite flow with Supabase's
  `inviteUserByEmail` + deep-linked password setup once you're ready to
  configure SMTP and a custom URL scheme handler for the reset link.

## What's intentionally out of scope for this MVP

- Billing / invoicing (the reports screen computes hours delivered — the
  input to billing and payroll — but doesn't generate invoices or run
  payroll).
- Recurring shift edits/deletes as a series (cancelling is per-occurrence).
- Push notifications for missed visits / incidents (see the note above).
- Care plan templates library — each patient's care plan is authored from
  scratch today.
- Offline support — every screen assumes a network connection to Supabase.
