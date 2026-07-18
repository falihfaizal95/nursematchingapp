import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import type { Photo } from "@/lib/types";

export async function uploadVisitPhoto(params: {
  visitId: string;
  patientId: string;
  localUri: string;
  fileExt?: string;
}): Promise<Photo> {
  const ext = params.fileExt || params.localUri.split(".").pop() || "jpg";
  const path = `${params.patientId}/${params.visitId}/${Date.now()}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(params.localUri, { encoding: "base64" });
  const arrayBuffer = decode(base64);

  const { error: uploadError } = await supabase.storage
    .from("visit-photos")
    .upload(path, arrayBuffer, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("photos")
    .insert({ visit_id: params.visitId, patient_id: params.patientId, storage_path: path })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return data as Photo;
}

export async function getSignedPhotoUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from("visit-photos").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}
