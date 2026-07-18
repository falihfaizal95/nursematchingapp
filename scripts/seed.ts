// Seeds a demo agency: 1 admin, 3 nurses, 4 patients with care plans,
// 2 family accounts, and ~2 weeks of completed visits + vitals so the
// family dashboard charts have something to show.
//
// Usage: npm run seed
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from
// .env.local) — the service role key bypasses RLS for provisioning.

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present — assume env vars are already set (e.g. CI).
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill it in.");
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

async function main() {
  console.log("Seeding Harbor Home Care demo data...");

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .insert({ name: "Harbor Home Care" })
    .select("id")
    .single();
  if (agencyError) throw agencyError;
  const agencyId = agency.id as string;

  // --- Admin -----------------------------------------------------------
  const adminId = await createAuthUser("admin@harborcare.demo", "Alex Rivera");
  await supabase.from("users").insert({
    id: adminId,
    agency_id: agencyId,
    role: "admin",
    full_name: "Alex Rivera",
    email: "admin@harborcare.demo",
  });

  // --- Nurses ------------------------------------------------------------
  const nurseNames = ["Jordan Blake", "Priya Nair", "Marcus Webb"];
  const nurseIds: string[] = [];
  for (let i = 0; i < nurseNames.length; i++) {
    const email = `nurse${i + 1}@harborcare.demo`;
    const id = await createAuthUser(email, nurseNames[i]);
    await supabase.from("users").insert({
      id,
      agency_id: agencyId,
      role: "nurse",
      full_name: nurseNames[i],
      email,
      phone: `555-010${i}`,
    });
    nurseIds.push(id);
  }

  // --- Patients ------------------------------------------------------------
  // Coordinates clustered around a sample metro area (Atlanta, GA) so
  // GPS check-in distance checks have realistic values.
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
    },
    {
      full_name: "Rosa Delgado",
      date_of_birth: "1950-06-21",
      address: "301 Highland Ave, Atlanta, GA 30312",
      lat: 33.7550,
      lng: -84.3650,
      primary_condition: "Post-hip replacement recovery",
      allergies: "Latex",
      emergency_contact_name: "Miguel Delgado",
      emergency_contact_phone: "555-0203",
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
    },
  ];

  const patientIds: string[] = [];
  for (const def of patientDefs) {
    const { data: patient, error } = await supabase
      .from("patients")
      .insert({ agency_id: agencyId, ...def })
      .select("id")
      .single();
    if (error) throw error;
    patientIds.push(patient.id);
  }

  // --- Care plans + tasks ------------------------------------------------
  const taskSets: { label: string; category: string; instructions?: string }[][] = [
    [
      { label: "Check blood pressure and heart rate", category: "vitals" },
      { label: "Administer morning medications", category: "medication", instructions: "See med list in binder" },
      { label: "Assist with bathing", category: "bathing" },
      { label: "Prepare light breakfast", category: "meals" },
    ],
    [
      { label: "Check blood glucose", category: "vitals" },
      { label: "Administer insulin per sliding scale", category: "medication" },
      { label: "Assist with mobility exercises", category: "mobility" },
      { label: "Prepare diabetic-friendly lunch", category: "meals" },
    ],
    [
      { label: "Wound care — hip incision site", category: "wound_care", instructions: "Change dressing, check for redness" },
      { label: "Assist with physical therapy exercises", category: "mobility" },
      { label: "Check vitals", category: "vitals" },
    ],
    [
      { label: "Assist with mobility and fall-risk supervision", category: "mobility" },
      { label: "Administer medications", category: "medication" },
      { label: "Check vitals and tremor notes", category: "vitals" },
      { label: "Prepare meals", category: "meals" },
    ],
  ];

  const carePlanIdsByPatient: Record<string, string> = {};
  const careTasksByPatient: Record<string, string[]> = {};

  for (let i = 0; i < patientIds.length; i++) {
    const { data: plan, error } = await supabase
      .from("care_plans")
      .insert({ agency_id: agencyId, patient_id: patientIds[i], title: "Daily Care Plan" })
      .select("id")
      .single();
    if (error) throw error;
    carePlanIdsByPatient[patientIds[i]] = plan.id;

    const tasks = taskSets[i].map((t, idx) => ({ care_plan_id: plan.id, sort_order: idx, ...t }));
    const { data: insertedTasks, error: taskError } = await supabase.from("care_tasks").insert(tasks).select("id");
    if (taskError) throw taskError;
    careTasksByPatient[patientIds[i]] = insertedTasks.map((t) => t.id);
  }

  // --- Family accounts -----------------------------------------------------
  const familyDefs = [
    { email: "family1@harborcare.demo", full_name: "Susan Whitfield", relationship: "Daughter", patientIndex: 0 },
    { email: "family2@harborcare.demo", full_name: "Diane Jennings", relationship: "Spouse", patientIndex: 1 },
  ];
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
  }

  // --- Shifts + visits + vitals for the past 2 weeks ----------------------
  const now = new Date();
  for (let p = 0; p < patientIds.length; p++) {
    const patientId = patientIds[p];
    const nurseId = nurseIds[p % nurseIds.length];
    const taskIds = careTasksByPatient[patientId];

    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      const day = new Date(now);
      day.setDate(day.getDate() - daysAgo);
      const start = new Date(day);
      start.setHours(9, 0, 0, 0);
      const end = new Date(day);
      end.setHours(11, 0, 0, 0);

      const { data: shift, error: shiftError } = await supabase
        .from("shifts")
        .insert({
          agency_id: agencyId,
          patient_id: patientId,
          nurse_id: nurseId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "completed",
        })
        .select("id")
        .single();
      if (shiftError) throw shiftError;

      const checkIn = new Date(start.getTime() + 2 * 60_000);
      const checkOut = new Date(end.getTime() - 5 * 60_000);
      const patientDef = patientDefs[p];

      const { data: visit, error: visitError } = await supabase
        .from("visits")
        .insert({
          agency_id: agencyId,
          shift_id: shift.id,
          patient_id: patientId,
          nurse_id: nurseId,
          check_in_at: checkIn.toISOString(),
          check_in_lat: patientDef.lat,
          check_in_lng: patientDef.lng,
          check_in_flagged: false,
          check_in_distance_m: Math.round(Math.random() * 20),
          check_out_at: checkOut.toISOString(),
          check_out_lat: patientDef.lat,
          check_out_lng: patientDef.lng,
          status: "completed",
        })
        .select("id")
        .single();
      if (visitError) throw visitError;

      await supabase
        .from("visit_tasks")
        .insert(taskIds.map((care_task_id) => ({ visit_id: visit.id, care_task_id, completed: true, completed_at: checkOut.toISOString() })));

      await supabase.from("vitals").insert({
        visit_id: visit.id,
        patient_id: patientId,
        bp_systolic: 118 + Math.round(Math.random() * 20 - 10),
        bp_diastolic: 76 + Math.round(Math.random() * 10 - 5),
        heart_rate: 70 + Math.round(Math.random() * 16 - 8),
        glucose: 95 + Math.round(Math.random() * 40 - 20),
        temperature: (98.6 + (Math.random() - 0.5)).toFixed(1),
        pain_level: Math.max(0, Math.round(Math.random() * 4)),
        mood: ["content", "cheerful", "tired", "content"][Math.floor(Math.random() * 4)],
        recorded_at: checkIn.toISOString(),
      });

      await supabase.from("visit_notes").insert({
        visit_id: visit.id,
        summary: "Stable visit — all care tasks completed without issue.",
        body: "Patient in good spirits. Vitals within normal range. No concerns to report.",
      });
    }

    // Upcoming shift for today + tomorrow so the live board / calendar aren't empty.
    for (const offset of [0, 1]) {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      const start = new Date(day);
      start.setHours(9, 0, 0, 0);
      const end = new Date(day);
      end.setHours(11, 0, 0, 0);
      if (start < now) continue;

      await supabase.from("shifts").insert({
        agency_id: agencyId,
        patient_id: patientId,
        nurse_id: nurseId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "scheduled",
      });
    }
  }

  // --- One open incident for realism --------------------------------------
  await supabase.from("incidents").insert({
    agency_id: agencyId,
    patient_id: patientIds[2],
    nurse_id: nurseIds[2 % nurseIds.length],
    type: "concern",
    severity: "low",
    description: "Patient mentioned mild dizziness when standing. Advised to rise slowly; will monitor next visit.",
  });

  console.log("\nDone. Demo accounts (all use the same password):\n");
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  console.log("  Admin:   admin@harborcare.demo");
  console.log("  Nurses:  nurse1@harborcare.demo, nurse2@harborcare.demo, nurse3@harborcare.demo");
  console.log("  Family:  family1@harborcare.demo (Eleanor Whitfield), family2@harborcare.demo (Harold Jennings)\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
