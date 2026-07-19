import { createClient } from "@/lib/supabase/client";
import type { PatientUpdate } from "@/lib/types";

// Runs client-side (not a server action) so a photo file can be streamed
// straight to Storage instead of round-tripping through Next.js. RLS
// (patient_updates_family_insert / patient_photos_write policies) is what
// actually enforces that only a linked family member can do this.
export async function addFamilyUpdate(params: {
  patientId: string;
  agencyId: string;
  authorId: string;
  body: string;
  file?: File | null;
}): Promise<PatientUpdate> {
  const supabase = createClient();
  let photoPath: string | null = null;

  if (params.file) {
    const ext = params.file.name.split(".").pop() || "jpg";
    photoPath = `${params.patientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("patient-photos")
      .upload(photoPath, params.file);
    if (uploadError) throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("patient_updates")
    .insert({
      agency_id: params.agencyId,
      patient_id: params.patientId,
      author_id: params.authorId,
      type: params.file ? "family_photo" : "family_note",
      body: params.body || null,
      photo_path: photoPath,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return data as PatientUpdate;
}

export async function getSignedPhotoUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("patient-photos").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}
