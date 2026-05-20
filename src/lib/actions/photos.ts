"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { PhotoStatus } from "@/types";

const EVENT_GALLERY_PHOTO_USAGE = "event_gallery";

async function validateAdminAccess(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  adminCode: string
) {
  const { data: event } = await supabase
    .from("events")
    .select("admin_code, slug")
    .eq("id", eventId)
    .single();

  if (!event || event.admin_code !== adminCode) {
    return { valid: false as const, error: "Not authorized. Admin access required." };
  }
  return { valid: true as const, eventSlug: event.slug as string };
}

function revalidatePhotoReviewPaths(adminCode: string, eventSlug: string, includesTeamIcon: boolean) {
  revalidatePath(`/admin/${adminCode}/social`);
  if (includesTeamIcon) {
    revalidatePath(`/admin/${adminCode}/hackathon`);
    revalidatePath(`/${eventSlug}/hackathon`);
  }
}

export async function getEventPhotos(eventId: string, status?: PhotoStatus) {
  const supabase = await createServiceClient();

  let query = supabase
    .from("event_photos")
    .select("*, uploader:uploaded_by(id, name, email)")
    .eq("event_id", eventId)
    .eq("photo_usage", EVENT_GALLERY_PHOTO_USAGE)
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
    .eq("photo_usage", EVENT_GALLERY_PHOTO_USAGE)
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

  const { data: photo } = await supabase
    .from("event_photos")
    .select("photo_usage")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle();

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

  revalidatePhotoReviewPaths(adminCode, auth.eventSlug, photo?.photo_usage === "hackathon_team_icon");
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

  const { data: photo } = await supabase
    .from("event_photos")
    .select("photo_usage")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle();

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

  revalidatePhotoReviewPaths(adminCode, auth.eventSlug, photo?.photo_usage === "hackathon_team_icon");
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
    .select("storage_path, photo_usage")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .single();

  if (!photo) {
    return { error: "Photo not found" };
  }

  if (photo.photo_usage === "hackathon_team_icon") {
    await supabase
      .from("hackathon_teams")
      .update({ icon_photo_id: null, updated_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("icon_photo_id", photoId);
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

  revalidatePhotoReviewPaths(adminCode, auth.eventSlug, photo.photo_usage === "hackathon_team_icon");
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

  const { data: photos } = await supabase
    .from("event_photos")
    .select("photo_usage")
    .in("id", photoIds)
    .eq("event_id", eventId);

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

  revalidatePhotoReviewPaths(
    adminCode,
    auth.eventSlug,
    (photos ?? []).some((photo) => photo.photo_usage === "hackathon_team_icon")
  );
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

  if (!isCurrentlyFeatured) {
    const { data: photo } = await supabase
      .from("event_photos")
      .select("id")
      .eq("id", photoId)
      .eq("event_id", eventId)
      .eq("photo_usage", EVENT_GALLERY_PHOTO_USAGE)
      .eq("status", "approved")
      .maybeSingle();

    if (!photo) {
      return { error: "Only approved event gallery photos can be featured." };
    }
  }

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
