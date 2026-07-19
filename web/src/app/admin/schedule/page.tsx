import { requireUser } from "@/lib/current-user";
import { createShift, cancelShift } from "@/lib/actions/admin-schedule";
import { X } from "lucide-react";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SchedulePage() {
  const { supabase, profile } = await requireUser("admin");

  const [{ data: patients }, { data: nurses }, { data: upcoming }] = await Promise.all([
    supabase.from("patients").select("id, full_name").eq("agency_id", profile.agency_id).eq("active", true).order("full_name"),
    supabase.from("users").select("id, full_name").eq("agency_id", profile.agency_id).eq("role", "nurse").order("full_name"),
    supabase
      .from("shifts")
      .select("*, patients(full_name), users!shifts_nurse_id_fkey(full_name)")
      .eq("agency_id", profile.agency_id)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(30),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-stone-900">Schedule</h1>

      <form action={createShift} className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-medium text-stone-900">New recurring shift</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Patient</label>
            <select name="patient_id" required className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Nurse</label>
            <select name="nurse_id" required className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
              {(nurses ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Start date</label>
            <input type="date" name="start_date" required className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Start time</label>
            <input type="time" name="start_time" required defaultValue="09:00" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">End time</label>
            <input type="time" name="end_time" required defaultValue="11:00" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Repeat on</label>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((day, i) => (
              <label key={day} className="flex items-center gap-1.5 text-sm text-stone-600">
                <input type="checkbox" name="weekdays" value={i} />
                {day}
              </label>
            ))}
          </div>
          <p className="text-xs text-stone-400">Leave all unchecked for a one-time shift on the start date.</p>
        </div>

        <div className="max-w-[160px] space-y-1">
          <label className="text-sm font-medium text-stone-700">For how many weeks</label>
          <input
            type="number"
            name="weeks"
            min={1}
            max={26}
            defaultValue={1}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        <button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
          Create shift(s)
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">Upcoming</h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Nurse</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(upcoming ?? []).map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-stone-600">{new Date(s.start_time).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {(s as unknown as { patients: { full_name: string } }).patients?.full_name}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {(s as unknown as { users: { full_name: string } }).users?.full_name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={async () => {
                        "use server";
                        await cancelShift(s.id);
                      }}
                    >
                      <button className="text-stone-300 hover:text-red-500" title="Cancel shift">
                        <X size={15} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(upcoming ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                    No upcoming shifts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
