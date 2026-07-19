import { requireUser } from "@/lib/current-user";
import { inviteNurse } from "@/lib/actions/admin-people";

export const dynamic = "force-dynamic";

export default async function NursesPage() {
  const { supabase, profile } = await requireUser("admin");

  const { data: nurses } = await supabase
    .from("users")
    .select("*")
    .eq("agency_id", profile.agency_id)
    .eq("role", "nurse")
    .order("full_name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-stone-900">Nurses</h1>

      <div className="rounded-xl border border-stone-200 bg-white">
        <ul className="divide-y divide-stone-100">
          {(nurses ?? []).map((n) => (
            <li key={n.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-stone-900">{n.full_name}</p>
                <p className="text-stone-500">{n.email}</p>
              </div>
              {n.phone && <p className="text-stone-500">{n.phone}</p>}
            </li>
          ))}
          {(nurses ?? []).length === 0 && (
            <li className="px-5 py-8 text-center text-stone-400">No nurses yet.</li>
          )}
        </ul>
      </div>

      <form
        action={inviteNurse}
        className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-stone-300 p-5 sm:grid-cols-4"
      >
        <input name="full_name" placeholder="Full name" required className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <input name="email" type="email" placeholder="Email" required className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <button className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
          Send invite
        </button>
      </form>
    </div>
  );
}
