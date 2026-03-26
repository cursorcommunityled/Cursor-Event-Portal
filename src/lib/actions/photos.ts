"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { PhotoStatus } from "@/types";

async function validateAdminAccess(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  adminCode: string
) {
  const { data: event } = await supabase
    .from("events")
    .select("admin_code")
    .eq("id", eventId)
    .single();

  if (!event || event.admin_code !== adminCode) {
    return { valid: false as const, error: "Not authorized. Admin access required." };
  }
  return { valid: true as const };
}

export async function getEventPhotos(eventId: string, status?: PhotoStatus) {
  const supabase = await createServiceClient();

  let query = supabase
    .from("event_photos")
    .select("*, uploader:uploaded_by(id, name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getEventPhotos] Error:", error);
    return [];
  }

  return data ?? [];
}

export async function getPendingPhotoCount(eventId: string) {
  const supabase = await createServiceClient();

  const { count, error } = await supabase
    .from("event_photos")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "pending");

  if (error) {
    console.error("[getPendingPhotoCount] Error:", error);
    return 0;
  }

  return count ?? 0;
}

export async function approvePhoto(
  photoId: string,
  eventId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();
  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) return { error: auth.error };

  const { error } = await supabase
    .from("event_photos")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[approvePhoto] Error:", error);
    return { error: error.message };
  }

  revalidatePath(`/admin/${adminCode}/social`);
  return { success: true };
}

export async function rejectPhoto(
  photoId: string,
  eventId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();
  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) return { error: auth.error };

  const { error } = await supabase
    .from("event_photos")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[rejectPhoto] Error:", error);
    return { error: error.message };
  }

  revalidatePath(`/admin/${adminCode}/social`);
  return { success: true };
}

export async function deletePhoto(
  photoId: string,
  eventId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();
  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) return { error: auth.error };

  const { data: photo } = await supabase
    .from("event_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .single();

  if (!photo) {
    return { error: "Photo not found" };
  }

  await supabase.storage.from("event-photos").remove([photo.storage_path]);

  const { error } = await supabase
    .from("event_photos")
    .delete()
    .eq("id", photoId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[deletePhoto] Error:", error);
    return { error: error.message };
  }

  revalidatePath(`/admin/${adminCode}/social`);
  return { success: true };
}

export async function bulkApprovePhotos(
  photoIds: string[],
  eventId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();
  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) return { error: auth.error };

  const { error } = await supabase
    .from("event_photos")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .in("id", photoIds)
    .eq("event_id", eventId);

  if (error) {
    console.error("[bulkApprovePhotos] Error:", error);
    return { error: error.message };
  }

  revalidatePath(`/admin/${adminCode}/social`);
  return { success: true };
}

// ─── Hero Gallery Featured Photos ─────────────────────────────────────────────

const HERO_FEATURED_KEY = "hero_featured_photo_ids";

export async function getHeroFeaturedIds(): Promise<string[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", HERO_FEATURED_KEY)
    .single();

  if (!data?.value) return [];
  try {
    return JSON.parse(data.value);
  } catch {
    return [];
  }
}

export async function toggleHeroFeatured(
  photoId: string,
  eventId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();
  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) return { error: auth.error };

  const current = await getHeroFeaturedIds();
  const isCurrentlyFeatured = current.includes(photoId);
  const updated = isCurrentlyFeatured
    ? current.filter((id) => id !== photoId)
    : [...current, photoId];

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: HERO_FEATURED_KEY, value: JSON.stringify(updated) }, { onConflict: "key" });

  if (error) {
    console.error("[toggleHeroFeatured] Error:", error);
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true, featured: !isCurrentlyFeatured, featuredIds: updated };
}
