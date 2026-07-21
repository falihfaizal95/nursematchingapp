import { createClient } from "@/lib/supabase/client";

// Uploads the one optional visit photo from the browser (streams the file
// straight to Storage), records it on the visit, and drops a timeline entry.
// RLS (patient_photos_write + patient_updates_caregiver_insert) enforces access.
export async function uploadVisitPhoto(params: {
  visitId: string;
  patientId: string;
  agencyId: string;
  authorId: string;
  file: File;
}): Promise<string> {
  const supabase = createClient();
  const ext = params.file.name.split(".").pop() || "jpg";
  const path = `${params.patientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("patient-photos")
    .upload(path, params.file);
  if (uploadError) throw new Error(uploadError.message);

  const { error: visitError } = await supabase
    .from("visits")
    .update({ photo_path: path })
    .eq("id", params.visitId);
  if (visitError) throw new Error(visitError.message);

  await supabase.from("patient_updates").insert({
    agency_id: params.agencyId,
    patient_id: params.patientId,
    visit_id: params.visitId,
    author_id: params.authorId,
    type: "visit_photo",
    body: "Added a photo",
    photo_path: path,
  });

  return path;
}
