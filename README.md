# Harbor Home Care

A home care coordination platform: the operating system for a private home
care agency. Three experiences share one Postgres database (Supabase),
partitioned by `agency_id` on every table so the same schema can serve
multiple agencies later.

- **Nurse (mobile-first PWA)** — today's schedule, GPS-verified check-in,
  care-plan checklist, vitals, structured visit notes, photos, GPS check-out,
  and an incident report form.
- **Family (web portal)** — latest visit summary, vitals trend charts, photo
  timeline, upcoming visit calendar, a weekly "care score," and a message
  thread with the agency. Read-only except for messaging.
- **Admin (web dashboard)** — patients, care plans, nurses, scheduling, a
  live board of today's visits (scheduled / checked-in / completed / missed),
  incident review, family invites, and hours-delivered reporting.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, Supabase (Postgres,
Auth, Storage, Row-Level Security), deployed on Vercel.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com/dashboard).

2. **Run the schema migration.** In the Supabase SQL Editor, paste and run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates every table, the `agency_id`-scoped RLS policies, and the
   private `visit-photos` storage bucket. (If you have the Supabase CLI
   linked to the project instead, `supabase db push` works too.)

3. **Copy environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in from Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only, used to provision nurse/family
     accounts via `supabase.auth.admin`. Never expose this to the client.

4. **Install and seed:**

   ```bash
   npm install
   npm run seed
   ```

   This creates one agency, one admin, three nurses, four patients with
   realistic care plans, two family accounts, and two weeks of completed
   visits with vitals (so the family dashboard charts have data on first
   load). All seeded accounts share the password printed at the end of the
   script.

5. **Run it:**

   ```bash
   npm run dev
   ```

   Sign in at `/login`. Each role is redirected to its own section
   (`/admin`, `/nurse`, `/family`) and cannot browse into the others — both
   the proxy (`src/proxy.ts`) and RLS enforce that boundary.

6. **Try the nurse PWA:** open `/nurse` on a phone (or Chrome DevTools
   device mode) and use "Add to Home Screen" — it installs standalone via
   `public/manifest.json`.

## Deploying to Vercel

```bash
vercel deploy
```

Set the same three environment variables (plus `NEXT_PUBLIC_SITE_URL` — your
production URL, used to build invite-email redirect links) in the Vercel
project settings before the first deploy.

## Data model

`agencies → users (role: admin/nurse/family) → patients → care_plans →
care_tasks`, and per visit: `shifts → visits → visit_tasks, vitals,
visit_notes, photos`. `incidents` and `messages` hang off `patients`.
Every table carries `agency_id`; every read/write is scoped by Supabase RLS
policies in the migration (nurses see only their assigned patients, families
see only their linked patient, admins see their whole agency).

`family_links` is a join table (family user ↔ patient) so a family member
can in principle follow more than one patient, and a patient can have more
than one family member watching.

Live-board status (scheduled / checked-in / completed / **missed**) is
derived on read (`src/lib/shift-status.ts`) rather than stored — a shift is
"missed" once its start time + 15 minutes has passed with no check-in. See
the production note below on why this needs a scheduled job.

## HIPAA-minded, at MVP level

This is a starting point, not a compliance certification. What's already in place:

- Every PHI-bearing table has RLS enabled; there is no anonymous read path.
- Photos live in a **private** Supabase Storage bucket; the family and nurse
  UIs only ever get short-lived signed URLs, never public paths.
- `audit_log` records who did what to which entity and when
  (`src/lib/audit.ts`) — called from check-in/out, patient edits, incident
  creation, and invites. Extend this to every PHI read if you need full
  access accountability.
- No PHI appears in URLs (routes use opaque UUIDs) or in server logs.
- Passwords are never handled by application code — Supabase Auth owns
  credential storage, hashing, and the invite/reset email flow.

**What a real production deployment still needs:**

- A signed **BAA (Business Associate Agreement)** with Supabase and Vercel
  before any real patient data touches this system.
- Encryption at rest — Supabase Postgres and Storage support this; confirm
  it's enabled on your project tier.
- Session timeouts / idle logout, especially for the family portal on shared
  devices.
- A scheduled job (Vercel Cron hitting a route handler, or a Supabase Edge
  Function) that proactively checks for missed visits and open incidents and
  pages the admin — today that logic runs only when someone has the live
  board open.
- Tightening the `visit-photos` storage write policy, which currently allows
  any authenticated user to upload to any path in the bucket (visibility is
  still correctly restricted by the `photos` table RLS policies, but the
  write path itself isn't yet scoped to "nurse's own visit").
- Real geocoding on patient address entry (admin currently enters lat/lng by
  hand) and a device-spoofing–resistant location check for GPS check-in.
- Rate limiting on auth and message endpoints, and a documented data
  retention / deletion policy.
- Structured logging with PHI redaction, and log retention limits.

## What's intentionally out of scope for this MVP

- Billing / invoicing (the reports page computes hours delivered — the input
  to billing and payroll — but doesn't generate invoices or run payroll).
- Recurring shift edits/deletes as a series (cancelling is per-occurrence).
- Push notifications for missed visits / incidents (see the cron note above).
- Care plan templates library — each patient's care plan is authored from
  scratch today.
