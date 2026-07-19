import type { SupabaseClient } from "@supabase/supabase-js";

// Records who did what, to what, and when — required for HIPAA-minded
// access accountability. Call from every server action that reads or
// mutates PHI-bearing tables (patients, visits, vitals, notes, photos...).
export async function recordAudit(
  supabase: SupabaseClient,
  params: {
    agencyId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_log").insert({
    agency_id: params.agencyId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? null,
  });
}
