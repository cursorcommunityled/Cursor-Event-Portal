"use server";

import { createServiceClient } from "@/lib/supabase/server";
import type { InAppNotification, NotificationPreferences } from "@/types";

export async function getMyNotifications(
  userId: string,
  eventId: string,
  limit = 20
): Promise<InAppNotification[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("in_app_notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []) as InAppNotification[];
}

export async function markNotificationRead(id: string, userId: string) {
  const supabase = await createServiceClient();
  await supabase
    .from("in_app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  return { success: true };
}

export async function markAllNotificationsRead(userId: string, eventId: string) {
  const supabase = await createServiceClient();
  await supabase
    .from("in_app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .is("read_at", null);
  return { success: true };
}

export async function getMyPreferences(
  userId: string,
  eventId: string
): Promise<NotificationPreferences> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (data) return data as NotificationPreferences;

  // Return defaults (no row yet)
  return {
    user_id: userId,
    event_id: eventId,
    poll_opened_inapp: true,
    poll_opened_email: false,
    table_assigned_inapp: true,
    table_assigned_email: false,
    demo_slot_inapp: true,
    demo_slot_email: false,
    survey_live_inapp: true,
    survey_live_email: false,
    announcements_inapp: true,
    announcements_email: false,
    updated_at: new Date().toISOString(),
  };
}

export async function updateMyPreferences(
  userId: string,
  eventId: string,
  patch: Partial<Omit<NotificationPreferences, "user_id" | "event_id" | "updated_at">>
): Promise<{ success: boolean }> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      { user_id: userId, event_id: eventId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id,event_id" }
    );

  if (error) {
    console.error("[updateMyPreferences]", error);
    return { success: false };
  }
  return { success: true };
}
