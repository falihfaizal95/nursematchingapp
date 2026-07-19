import { requireUser } from "@/lib/current-user";
import { getSelectedPatient } from "@/lib/family";
import type { Photo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { supabase, profile } = await requireUser("family");
  const { patient: patientParam } = await searchParams;
  const patient = await getSelectedPatient(supabase, profile.id, patientParam);

  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false });

  const withUrls = await Promise.all(
    ((photos ?? []) as Photo[]).map(async (p) => {
      const { data } = await supabase.storage.from("visit-photos").createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Photo timeline</h1>
        <p className="text-sm text-stone-500">Shared by the care team for {patient.full_name}</p>
      </div>

      {withUrls.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-400">
          No photos shared yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {withUrls.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.caption || "Care photo"} className="aspect-square w-full object-cover" />
              )}
              <figcaption className="p-2 text-xs text-stone-500">
                {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {p.caption && ` · ${p.caption}`}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
