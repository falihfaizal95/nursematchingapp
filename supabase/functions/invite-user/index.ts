// Admin-only: creates a nurse or family auth user + profile row, and (for
// family) links them to a patient. Runs with the service-role key, which
// never ships inside the mobile app bundle — this is the one privileged
// operation the app can't safely do client-side.
//
// Deploy: supabase functions deploy invite-user
// Secrets (service role key is provided automatically as SUPABASE_SERVICE_ROLE_KEY
// and SUPABASE_URL by the platform — no manual `secrets set` needed for those).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 14) + "!9";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Not signed in" }, 401);

    const { data: callerProfile } = await callerClient
      .from("users")
      .select("role, agency_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return json({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const role = body.role as "nurse" | "family";
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = body.phone ? String(body.phone) : null;
    const patientId = body.patient_id ? String(body.patient_id) : null;
    const relationship = body.relationship ? String(body.relationship) : null;

    if (role !== "nurse" && role !== "family") {
      return json({ error: "role must be 'nurse' or 'family'" }, 400);
    }
    if (!fullName || !email) {
      return json({ error: "full_name and email are required" }, 400);
    }
    if (role === "family" && !patientId) {
      return json({ error: "patient_id is required to invite a family member" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (role === "family") {
      const { data: patient } = await adminClient
        .from("patients")
        .select("id")
        .eq("id", patientId)
        .eq("agency_id", callerProfile.agency_id)
        .single();
      if (!patient) return json({ error: "Patient not found in your agency" }, 404);
    }

    const tempPassword = randomPassword();

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) {
      return json({ error: createError?.message || "Failed to create user" }, 400);
    }

    const { error: profileError } = await adminClient.from("users").insert({
      id: created.user.id,
      agency_id: callerProfile.agency_id,
      role,
      full_name: fullName,
      email,
      phone,
    });
    if (profileError) return json({ error: profileError.message }, 400);

    if (role === "family") {
      const { error: linkError } = await adminClient.from("family_links").insert({
        patient_id: patientId,
        family_user_id: created.user.id,
        relationship,
      });
      if (linkError) return json({ error: linkError.message }, 400);
    }

    await adminClient.from("audit_log").insert({
      agency_id: callerProfile.agency_id,
      user_id: caller.id,
      action: "invite",
      entity_type: role === "nurse" ? "nurse" : "family_member",
      entity_id: created.user.id,
      metadata: patientId ? { patient_id: patientId } : null,
    });

    return json({ userId: created.user.id, email, tempPassword });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
