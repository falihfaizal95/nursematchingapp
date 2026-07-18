import Link from "next/link";
import { CalendarClock, Sparkles, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { getSelectedPatient } from "@/lib/family";
import { getWeeklyCareScore } from "@/lib/care-score";
import type { AppUser, VisitTask, VisitNote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FamilyDashboard({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { supabase, profile } = await requireUser("family");
  const { patient: patientParam } = await searchParams;
  const patient = await getSelectedPatient(supabase, profile.id, patientParam);

  const [{ data: lastVisit }, careScore, { data: nextShift }] = await Promise.all([
    supabase
      .from("visits")
      .select("*, users!visits_nurse_id_fkey(*), visit_notes(*), visit_tasks(*, care_tasks(*))")
      .eq("patient_id", patient.id)
      .eq("status", "completed")
      .order("check_out_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getWeeklyCareScore(supabase, patient.id),
    supabase
      .from("shifts")
      .select("*, users!shifts_nurse_id_fkey(full_name)")
      .eq("patient_id", patient.id)
      .eq("status", "scheduled")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(1)
      .maybeSingle(),
  ]);

  const visit = lastVisit as unknown as
    | {
        id: string;
        check_out_at: string;
        users: AppUser;
        visit_notes: VisitNote[];
        visit_tasks: (VisitTask & { care_tasks: { label: string } })[];
      }
    | null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">Caring for</p>
        <h1 className="text-2xl font-semibold text-stone-900">{patient.full_name}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 p-5 text-white sm:col-span-1">
          <div className="flex items-center gap-1.5 text-teal-100">
            <Sparkles size={15} />
            <p className="text-xs font-medium uppercase tracking-wide">This week</p>
          </div>
          <p className="mt-3 text-4xl font-semibold">{careScore.score}</p>
          <p className="text-sm text-teal-100">care score</p>
          <p className="mt-3 text-xs text-teal-100">
            {careScore.visitsCompleted}/{careScore.visitsScheduled} visits · {careScore.tasksCompleted}/
            {careScore.tasksTotal} tasks done
          </p>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Latest visit</p>
          {visit ? (
            <div className="mt-2">
              <p className="text-sm text-stone-500">
                {new Date(visit.check_out_at).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                · by {visit.users?.full_name}
              </p>
              <p className="mt-1 font-medium text-stone-900">
                {visit.visit_notes?.[0]?.summary || "Visit completed"}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {visit.visit_tasks?.filter((t) => t.completed).length}/{visit.visit_tasks?.length || 0} care
                tasks completed
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-stone-400">No visits recorded yet.</p>
          )}
        </div>
      </div>

      {nextShift && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <CalendarClock className="text-amber-600" size={20} />
          <div>
            <p className="text-sm font-medium text-amber-900">
              Next visit {new Date(nextShift.start_time).toLocaleString(undefined, {
                weekday: "long",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <p className="text-xs text-amber-700">
              with {(nextShift as unknown as { users: { full_name: string } }).users?.full_name}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink href={`/family/vitals?patient=${patient.id}`} title="Vitals trends" subtitle="See how things have changed over time" />
        <QuickLink href={`/family/photos?patient=${patient.id}`} title="Photo timeline" subtitle="Wound progress and care moments" />
        <QuickLink href={`/family/calendar?patient=${patient.id}`} title="Upcoming visits" subtitle="This week's schedule" />
        <QuickLink href={`/family/messages?patient=${patient.id}`} title="Message the agency" subtitle="Ask a question, anytime" />
      </div>
    </div>
  );
}

function QuickLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-teal-300 hover:shadow-sm"
    >
      <div>
        <p className="font-medium text-stone-900">{title}</p>
        <p className="text-sm text-stone-500">{subtitle}</p>
      </div>
      <ArrowRight className="text-stone-300" size={18} />
    </Link>
  );
}
