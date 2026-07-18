import type { SupabaseClient } from "@supabase/supabase-js";

// A friendly weekly rollup for families: how many visits happened as planned,
// how much of the care plan was completed, and whether anything was flagged.
// Deliberately simple — this is reassurance, not a clinical metric.
export async function getWeeklyCareScore(supabase: SupabaseClient, patientId: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, status, visits(id, status, check_in_flagged)")
    .eq("patient_id", patientId)
    .gte("start_time", weekAgo.toISOString())
    .neq("status", "cancelled");

  const { data: tasks } = await supabase
    .from("visit_tasks")
    .select("completed, visits!inner(patient_id, check_in_at)")
    .eq("visits.patient_id", patientId)
    .gte("visits.check_in_at", weekAgo.toISOString());

  const { data: incidents } = await supabase
    .from("incidents")
    .select("id")
    .eq("patient_id", patientId)
    .gte("created_at", weekAgo.toISOString());

  const total = shifts?.length ?? 0;
  const completed = (shifts ?? []).filter(
    (s) => (s as unknown as { visits: { status: string }[] }).visits?.[0]?.status === "completed",
  ).length;
  const visitScore = total > 0 ? (completed / total) * 100 : 100;

  const taskTotal = tasks?.length ?? 0;
  const taskDone = (tasks ?? []).filter((t) => t.completed).length;
  const taskScore = taskTotal > 0 ? (taskDone / taskTotal) * 100 : 100;

  const incidentPenalty = Math.min((incidents?.length ?? 0) * 10, 30);

  const score = Math.max(0, Math.round(visitScore * 0.5 + taskScore * 0.5 - incidentPenalty));

  return {
    score,
    visitsCompleted: completed,
    visitsScheduled: total,
    tasksCompleted: taskDone,
    tasksTotal: taskTotal,
    incidentCount: incidents?.length ?? 0,
  };
}
