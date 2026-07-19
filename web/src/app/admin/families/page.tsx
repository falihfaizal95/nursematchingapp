import Link from "next/link";
import { requireUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const { supabase, profile } = await requireUser("admin");

  const { data: links } = await supabase
    .from("family_links")
    .select("*, users(*), patients(id, full_name)")
    .eq("patients.agency_id", profile.agency_id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-stone-900">Family accounts</h1>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Relationship</th>
            </tr>
          </thead>
          <tbody>
            {(links ?? []).map((l) => {
              const link = l as unknown as {
                id: string;
                relationship: string | null;
                users: { full_name: string; email: string };
                patients: { id: string; full_name: string } | null;
              };
              if (!link.patients) return null;
              return (
                <tr key={link.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium text-stone-900">{link.users?.full_name}</td>
                  <td className="px-4 py-3 text-stone-600">{link.users?.email}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/patients/${link.patients.id}`} className="text-teal-700 hover:underline">
                      {link.patients.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{link.relationship || "—"}</td>
                </tr>
              );
            })}
            {(links ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                  No family accounts yet. Invite one from a patient&apos;s page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
