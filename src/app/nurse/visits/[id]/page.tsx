import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { VisitFlow } from "./_components/visit-flow";
import type { VisitTask, CareTask, Vitals, VisitNote, Photo, Patient, Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireUser("nurse");

  const { data: visit } = await supabase
    .from("visits")
    .select("*, patients(*)")
    .eq("id", id)
    .eq("nurse_id", profile.id)
    .single();
  if (!visit) notFound();

  const [{ data: visitTasks }, { data: vitals }, { data: note }, { data: photos }] = await Promise.all([
    supabase
      .from("visit_tasks")
      .select("*, care_tasks(*)")
      .eq("visit_id", id),
    supabase.from("vitals").select("*").eq("visit_id", id).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("visit_notes").select("*").eq("visit_id", id).maybeSingle(),
    supabase.from("photos").select("*").eq("visit_id", id).order("created_at", { ascending: false }),
  ]);

  type TaskRow = VisitTask & { care_tasks: CareTask };

  return (
    <VisitFlow
      visit={visit as unknown as Visit & { patients: Patient }}
      visitTasks={(visitTasks ?? []) as unknown as TaskRow[]}
      vitals={(vitals ?? null) as Vitals | null}
      note={(note ?? null) as VisitNote | null}
      photos={(photos ?? []) as Photo[]}
    />
  );
}
