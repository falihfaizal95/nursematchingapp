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
  console.log("Seeding Harbor Home Care demo data...");
  await deleteExistingDemoUsers();

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .insert({ name: "Harbor Home Care" })
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
  const caregiverNames = ["Jordan Blake", "Priya Nair", "Marcus Webb"];
  const caregiverIds: string[] = [];
  for (let i = 0; i < caregiverNames.length; i++) {
    const email = `caregiver${i + 1}@harborcare.demo`;
    const id = await createAuthUser(email, caregiverNames[i]);
    await supabase.from("users").insert({
      id,
      agency_id: agencyId,
      role: "caregiver",
      full_name: caregiverNames[i],
      email,
      phone: `555-010${i}`,
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

  const patientIds: string[] = [];
  for (const def of patientDefs) {
    const { caregiverIndex, ...rest } = def;
    const { data: patient, error } = await supabase
      .from("patients")
      .insert({
        agency_id: agencyId,
        ...rest,
        caregiver_id: caregiverIndex !== null ? caregiverIds[caregiverIndex] : null,
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

  // --- ~10 days of completed visits + end-of-day reports ------------------
  const now = new Date();
  for (let p = 0; p < patientDefs.length; p++) {
    const def = patientDefs[p];
    if (def.caregiverIndex === null) continue;
    const patientId = patientIds[p];
    const caregiverId = caregiverIds[def.caregiverIndex];

    for (let daysAgo = 10; daysAgo >= 1; daysAgo--) {
      const day = new Date(now);
      day.setDate(day.getDate() - daysAgo);
      const clockIn = new Date(day);
      clockIn.setHours(9, Math.floor(Math.random() * 10), 0, 0);
      const clockOut = new Date(clockIn);
      clockOut.setHours(clockIn.getHours() + 2, clockIn.getMinutes() + 30, 0, 0);
      const report = REPORTS[Math.floor(Math.random() * REPORTS.length)];

      const { data: visit, error: visitError } = await supabase
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
          status: "completed",
        })
        .select("id")
        .single();
      if (visitError) throw visitError;

      await supabase.from("patient_updates").insert({
        agency_id: agencyId,
        patient_id: patientId,
        visit_id: visit.id,
        author_id: caregiverId,
        type: "shift_report",
        body: report,
        created_at: clockOut.toISOString(),
      });
    }

    // A couple of family-posted updates for realism, if this patient has family linked.
    const familyIndex = familyDefs.findIndex((f) => f.patientIndex === p);
    if (familyIndex >= 0) {
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      await supabase.from("patient_updates").insert({
        agency_id: agencyId,
        patient_id: patientId,
        author_id: familyIds[familyIndex],
        type: "family_note",
        body: "Dropped off her favorite soup — please let her know it's in the fridge!",
        created_at: twoDaysAgo.toISOString(),
      });
    }
  }

  // --- One active visit right now, so the live map/status isn't empty -----
  const liveDef = patientDefs[0];
  const clockInNow = new Date(now.getTime() - 55 * 60_000);
  await supabase.from("visits").insert({
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
    status: "active",
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
