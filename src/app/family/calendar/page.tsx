import { requireUser } from "@/lib/current-user";
import { getSelectedPatient } from "@/lib/family";
import { CalendarDays, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { supabase, profile } = await requireUser("family");
  const { patient: patientParam } = await searchParams;
  const patient = await getSelectedPatient(supabase, profile.id, patientParam);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, users!shifts_nurse_id_fkey(full_name)")
    .eq("patient_id", patient.id)
    .neq("status", "cancelled")
    .gte("start_time", yesterday.toISOString())
    .order("start_time")
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Upcoming visits</h1>
        <p className="text-sm text-stone-500">Scheduled care for {patient.full_name}</p>
      </div>

      <div className="space-y-3">
        {(shifts ?? []).map((s) => (
          <div key={s.id} className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <CalendarDays size={18} />
            </div>
            <div>
              <p className="font-medium text-stone-900">
                {new Date(s.start_time).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-sm text-stone-500">
                {new Date(s.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                {new Date(s.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-400">
                <User size={12} /> {(s as unknown as { users: { full_name: string } }).users?.full_name}
              </p>
            </div>
          </div>
        ))}
        {(shifts ?? []).length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-400">
            No upcoming visits scheduled.
          </div>
        )}
      </div>
    </div>
  );
}
