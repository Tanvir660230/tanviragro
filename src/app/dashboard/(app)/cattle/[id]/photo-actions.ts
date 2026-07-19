"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { PhotoType } from "@/types/database";

const BUCKET = "cattle-photos";

export async function uploadCattlePhoto(
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  const cattleId = formData.get("cattle_id") as string;
  const photoType = (formData.get("photo_type") as PhotoType) ?? "current";
  const takenAt = (formData.get("taken_at") as string) || null;

  if (!file || file.size === 0) return { error: "No file selected" };
  if (!cattleId) return { error: "Missing cattle ID" };
  if (file.size > 5 * 1024 * 1024) return { error: "File must be under 5 MB" };
  if (!file.type.startsWith("image/")) return { error: "Only image files allowed" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id")
    .eq("id", cattleId)
    .maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${cattleId}/${photoType}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadErr) return { error: "Upload failed: " + uploadErr.message };

  const { error: dbErr } = await supabase
    .from("cattle_photos")
    .insert({ cattle_id: cattleId, photo_type: photoType, storage_path: path, taken_at: takenAt });

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: "Failed to save photo record" };
  }

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  return { url: path };
}

export async function deleteCattlePhoto(
  photoId: string,
  storagePath: string,
  cattleId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id")
    .eq("id", cattleId)
    .maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  await supabase.storage.from(BUCKET).remove([storagePath]);
  await supabase.from("cattle_photos").delete().eq("id", photoId);

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  return {};
}
