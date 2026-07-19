import { requireUser } from "@/lib/current-user";
import { updateIncidentStatus } from "@/lib/actions/admin-schedule";

export const dynamic = "force-dynamic";

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-stone-100 text-stone-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default async function IncidentsPage() {
  const { supabase, profile } = await requireUser("admin");

  const { data: incidents } = await supabase
    .from("incidents")
    .select("*, patients(full_name), users!incidents_nurse_id_fkey(full_name)")
    .eq("agency_id", profile.agency_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-stone-900">Incidents</h1>

      <div className="space-y-3">
        {(incidents ?? []).map((inc) => (
          <div key={inc.id} className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[inc.severity]}`}>
                    {inc.severity}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-stone-400">{inc.type.replace("_", " ")}</span>
                </div>
                <p className="mt-2 font-medium text-stone-900">
                  {(inc as unknown as { patients: { full_name: string } }).patients?.full_name}
                </p>
                <p className="text-sm text-stone-600">{inc.description}</p>
                <p className="mt-1 text-xs text-stone-400">
                  Reported by {(inc as unknown as { users: { full_name: string } }).users?.full_name} ·{" "}
                  {new Date(inc.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium capitalize text-stone-600">
                  {inc.status}
                </span>
                {inc.status !== "resolved" && (
                  <div className="flex gap-2">
                    {inc.status === "open" && (
                      <form
                        action={async () => {
                          "use server";
                          await updateIncidentStatus(inc.id, "reviewed");
                        }}
                      >
                        <button className="text-xs font-medium text-teal-700 hover:underline">Mark reviewed</button>
                      </form>
                    )}
                    <form
                      action={async () => {
                        "use server";
                        await updateIncidentStatus(inc.id, "resolved");
                      }}
                    >
                      <button className="text-xs font-medium text-teal-700 hover:underline">Mark resolved</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {(incidents ?? []).length === 0 && (
          <p className="py-8 text-center text-stone-400">No incidents reported.</p>
        )}
      </div>
    </div>
  );
}
