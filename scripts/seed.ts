// Seeds a demo agency: 1 admin, 4 patients, 3 caregivers each assigned
// 1:1 to a patient (one patient left unassigned on purpose), 2 family
// accounts, ~10 days of completed visits with end-of-day reports so the
// family timeline has content, plus one currently-active visit so the
// live map/status has something to show immediately.
//
// Usage: npm run seed (from the repo root)
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env.local at
// the repo root) — the service role key bypasses RLS for provisioning.
// This script is shared by both apps (mobile/, web/) since it only talks
// to Supabase directly — it doesn't care which client reads the data.

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present — assume env vars are already set (e.g. CI).
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local (repo root) and fill it in.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_PASSWORD = "HarborDemo123!";

async function createAuthUser(email: string, fullName: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

const REPORTS = [
  "Stable day. Meds given on time, ate a full lunch, took an afternoon walk in the garden.",
  "Good spirits today. Watched a movie together, had a light appetite at dinner but drank plenty of water.",
  "Quiet day, mostly resting. No concerns — vitals looked normal when I checked in on them.",
  "A little more tired than usual this morning but perked up after breakfast. No issues otherwise.",
];

// Auth accounts from a previous seed run survive a schema reset (dropping
// public.users doesn't touch auth.users), so re-running this script would
// otherwise fail on "email already registered." Clear out old @harborcare.demo
// accounts first to keep this safely re-runnable.
async function deleteExistingDemoUsers() {
  let page = 1;
  const toDelete: string[] = [];
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.endsWith("@harborcare.demo")) toDelete.push(u.id);
    }
    if (data.users.length < 200) break;
    page++;
  }
  for (const id of toDelete) {
    await supabase.auth.admin.deleteUser(id);
  }
  if (toDelete.length) console.log(`Removed ${toDelete.length} demo account(s) from a previous seed run.`);
}

async function main() {
  console.log("Seeding Evoura Home Care demo data...");
  await deleteExistingDemoUsers();

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .insert({ name: "Evoura Home Care", phone: "555-0100" })
    .select("id")
    .single();
  if (agencyError) throw agencyError;
  const agencyId = agency.id as string;

  // --- Admin ---------------------------------------------------------------
  const adminId = await createAuthUser("admin@harborcare.demo", "Alex Rivera");
  await supabase.from("users").insert({
    id: adminId,
    agency_id: agencyId,
    role: "admin",
    full_name: "Alex Rivera",
    email: "admin@harborcare.demo",
  });

  // --- Caregivers ------------------------------------------------------------
  const caregiverDefs = [
    { name: "Jordan Blake", years: 6, bio: "Warm and dependable — 6 years in home care, loves a good crossword with clients." },
    { name: "Priya Nair", years: 9, bio: "Registered nurse background, specializes in diabetes and medication management." },
    { name: "Marcus Webb", years: 4, bio: "Patient and upbeat, great with post-surgery mobility and physical therapy support." },
  ];
  const caregiverIds: string[] = [];
  for (let i = 0; i < caregiverDefs.length; i++) {
    const email = `caregiver${i + 1}@harborcare.demo`;
    const id = await createAuthUser(email, caregiverDefs[i].name);
    await supabase.from("users").insert({
      id,
      agency_id: agencyId,
      role: "caregiver",
      full_name: caregiverDefs[i].name,
      email,
      phone: `555-011${i}`,
      years_experience: caregiverDefs[i].years,
      bio: caregiverDefs[i].bio,
    });
    caregiverIds.push(id);
  }

  // --- Patients --------------------------------------------------------------
  // Coordinates clustered around a sample metro area (Atlanta, GA) so
  // GPS distance checks have realistic values.
  const patientDefs = [
    {
      full_name: "Eleanor Whitfield",
      date_of_birth: "1938-04-12",
      address: "142 Maple Grove Ln, Atlanta, GA 30307",
      lat: 33.7701,
      lng: -84.3373,
      primary_condition: "Congestive heart failure",
      allergies: "Penicillin",
      emergency_contact_name: "Susan Whitfield",
      emergency_contact_phone: "555-0201",
      caregiverIndex: 0,
    },
    {
      full_name: "Harold Jennings",
      date_of_birth: "1945-11-02",
      address: "88 Ponce Terrace, Atlanta, GA 30308",
      lat: 33.7729,
      lng: -84.3818,
      primary_condition: "Type 2 diabetes",
      allergies: "None known",
      emergency_contact_name: "Diane Jennings",
      emergency_contact_phone: "555-0202",
      caregiverIndex: 1,
    },
    {
      full_name: "Rosa Delgado",
      date_of_birth: "1950-06-21",
      address: "301 Highland Ave, Atlanta, GA 30312",
      lat: 33.755,
      lng: -84.365,
      primary_condition: "Post-hip replacement recovery",
      allergies: "Latex",
      emergency_contact_name: "Miguel Delgado",
      emergency_contact_phone: "555-0203",
      caregiverIndex: 2,
    },
    {
      full_name: "Walter Simms",
      date_of_birth: "1942-01-30",
      address: "17 Decatur St, Atlanta, GA 30303",
      lat: 33.7537,
      lng: -84.3863,
      primary_condition: "Early-stage Parkinson's",
      allergies: "Sulfa drugs",
      emergency_contact_name: "Barbara Simms",
      emergency_contact_phone: "555-0204",
      caregiverIndex: null, // left unassigned on purpose
    },
  ];

  const now = new Date();
  const tomorrow9 = new Date(now);
  tomorrow9.setDate(tomorrow9.getDate() + 1);
  tomorrow9.setHours(9, 0, 0, 0);
  const today8 = new Date(now);
  today8.setHours(8, 0, 0, 0); // in the past -> drives a "missed" alert for the unassigned patient

  const patientIds: string[] = [];
  for (const def of patientDefs) {
    const { caregiverIndex, ...rest } = def;
    // Assigned patients have an upcoming visit tomorrow; the unassigned one
    // has an expected time already in the past so admin shows a missed alert.
    const nextVisit = caregiverIndex !== null ? tomorrow9 : today8;
    const { data: patient, error } = await supabase
      .from("patients")
      .insert({
        agency_id: agencyId,
        ...rest,
        caregiver_id: caregiverIndex !== null ? caregiverIds[caregiverIndex] : null,
        next_visit_at: nextVisit.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    patientIds.push(patient.id);
  }

  // --- Family accounts ---------------------------------------------------
  const familyDefs = [
    { email: "family1@harborcare.demo", full_name: "Susan Whitfield", relationship: "Daughter", patientIndex: 0 },
    { email: "family2@harborcare.demo", full_name: "Diane Jennings", relationship: "Spouse", patientIndex: 1 },
  ];
  const familyIds: string[] = [];
  for (const f of familyDefs) {
    const id = await createAuthUser(f.email, f.full_name);
    await supabase.from("users").insert({
      id,
      agency_id: agencyId,
      role: "family",
      full_name: f.full_name,
      email: f.email,
    });
    await supabase.from("family_links").insert({
      patient_id: patientIds[f.patientIndex],
      family_user_id: id,
      relationship: f.relationship,
    });
    familyIds.push(id);
  }

  // Full checklist (everything done) for completed visits.
  const FULL_CHECKLIST = {
    ate_breakfast: true,
    ate_lunch: true,
    ate_dinner: false,
    medication_given: true,
    showered: true,
    walked: true,
    drank_water: true,
    bathroom_assisted: true,
  };
  const TASK_EVENTS = [
    "Medication given",
    "Ate breakfast",
    "Ate lunch",
    "Drank enough water",
    "Showered / bathed",
    "Walked / active",
  ];
  const MOODS = ["great", "good", "great", "good", "okay"];

  async function insertEvent(
    patientId: string,
    caregiverId: string,
    visitId: string,
    type: string,
    body: string,
    at: Date,
  ) {
    await supabase.from("patient_updates").insert({
      agency_id: agencyId,
      patient_id: patientId,
      visit_id: visitId,
      author_id: caregiverId,
      type,
      body,
      created_at: at.toISOString(),
    });
  }

  // Insert a completed visit with a full checklist, mood, pain, note, and a
  // timeline (granular events only for recent days keeps the row count sane).
  async function seedCompletedVisit(
    p: number,
    clockIn: Date,
    clockOut: Date,
    opts: { granular: boolean; concern?: string } = { granular: false },
  ) {
    const def = patientDefs[p];
    const patientId = patientIds[p];
    const caregiverId = caregiverIds[def.caregiverIndex!];
    const report = REPORTS[Math.floor(Math.random() * REPORTS.length)];
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];

    const { data: visit, error } = await supabase
      .from("visits")
      .insert({
        agency_id: agencyId,
        patient_id: patientId,
        caregiver_id: caregiverId,
        clock_in_at: clockIn.toISOString(),
        clock_in_lat: def.lat,
        clock_in_lng: def.lng,
        clock_in_flagged: false,
        clock_in_distance_m: Math.round(Math.random() * 20),
        clock_out_at: clockOut.toISOString(),
        clock_out_lat: def.lat,
        clock_out_lng: def.lng,
        report,
        ...FULL_CHECKLIST,
        mood,
        pain_level: Math.floor(Math.random() * 3),
        concern_flag: !!opts.concern,
        concern_text: opts.concern ?? null,
        status: "completed",
      })
      .select("id")
      .single();
    if (error) throw error;

    await insertEvent(patientId, caregiverId, visit.id, "arrived", "Caregiver arrived", clockIn);
    if (opts.granular) {
      const span = clockOut.getTime() - clockIn.getTime();
      TASK_EVENTS.forEach((label, i) => {
        const at = new Date(clockIn.getTime() + (span * (i + 1)) / (TASK_EVENTS.length + 2));
        void insertEvent(patientId, caregiverId, visit.id, "task", label, at);
      });
    }
    if (opts.concern) {
      await insertEvent(patientId, caregiverId, visit.id, "concern", opts.concern, new Date(clockIn.getTime() + 30 * 60_000));
    }
    await insertEvent(patientId, caregiverId, visit.id, "shift_report", report, clockOut);
    await insertEvent(patientId, caregiverId, visit.id, "completed", "Shift complete", clockOut);
    return visit.id as string;
  }

  // --- ~10 days of history for each assigned patient ----------------------
  for (let p = 0; p < patientDefs.length; p++) {
    if (patientDefs[p].caregiverIndex === null) continue;
    for (let daysAgo = 10; daysAgo >= 1; daysAgo--) {
      const clockIn = new Date(now);
      clockIn.setDate(clockIn.getDate() - daysAgo);
      clockIn.setHours(9, Math.floor(Math.random() * 10), 0, 0);
      const clockOut = new Date(clockIn.getTime() + 2.5 * 3_600_000);
      // Flag one concern on Rosa's most recent past visit for the admin demo.
      const concern =
        p === 2 && daysAgo === 1
          ? "Mentioned mild dizziness when standing — advised to rise slowly, will keep an eye on it."
          : undefined;
      await seedCompletedVisit(p, clockIn, clockOut, { granular: daysAgo <= 2, concern });
    }
  }

  // --- Today: Harold's visit already complete (family sees a green summary) -
  const haroldIn = new Date(now.getTime() - 3 * 3_600_000);
  const haroldOut = new Date(now.getTime() - 40 * 60_000);
  await seedCompletedVisit(1, haroldIn, haroldOut, { granular: true });

  // --- Today: Eleanor's caregiver is on shift right now (live map/status) --
  const liveDef = patientDefs[0];
  const clockInNow = new Date(now.getTime() - 55 * 60_000);
  const { data: liveVisit } = await supabase
    .from("visits")
    .insert({
      agency_id: agencyId,
      patient_id: patientIds[0],
      caregiver_id: caregiverIds[0],
      clock_in_at: clockInNow.toISOString(),
      clock_in_lat: liveDef.lat,
      clock_in_lng: liveDef.lng,
      clock_in_flagged: false,
      clock_in_distance_m: 4,
      current_lat: liveDef.lat + 0.0006,
      current_lng: liveDef.lng - 0.0004,
      location_updated_at: new Date(now.getTime() - 2 * 60_000).toISOString(),
      medication_given: true,
      ate_breakfast: true,
      drank_water: true,
      mood: "great",
      pain_level: 1,
      report: "She's in a wonderful mood today — we had breakfast together and did the crossword.",
      status: "active",
    })
    .select("id")
    .single();
  if (liveVisit) {
    await insertEvent(patientIds[0], caregiverIds[0], liveVisit.id, "arrived", "Caregiver arrived", clockInNow);
    await insertEvent(patientIds[0], caregiverIds[0], liveVisit.id, "task", "Medication given", new Date(clockInNow.getTime() + 12 * 60_000));
    await insertEvent(patientIds[0], caregiverIds[0], liveVisit.id, "task", "Ate breakfast", new Date(clockInNow.getTime() + 30 * 60_000));
  }

  // --- A family-posted note on the timeline for realism -------------------
  await supabase.from("patient_updates").insert({
    agency_id: agencyId,
    patient_id: patientIds[0],
    author_id: familyIds[0],
    type: "family_note",
    body: "Dropped off her favorite soup — please let her know it's in the fridge!",
    created_at: new Date(now.getTime() - 26 * 3_600_000).toISOString(),
  });

  console.log("\nDone. Demo accounts (all use the same password):\n");
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  console.log("  Admin:      admin@harborcare.demo");
  console.log("  Caregivers: caregiver1@harborcare.demo, caregiver2@harborcare.demo, caregiver3@harborcare.demo");
  console.log("  Family:     family1@harborcare.demo (Eleanor Whitfield — currently clocked in!), family2@harborcare.demo (Harold Jennings)\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
