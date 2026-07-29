"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireEventAdmin } from "@/lib/auth/admin-action";
import { fanOutNotification } from "@/lib/notifications";
import { PIZZA_ALARM_ANNOUNCEMENT } from "@/lib/pizza-alarm";

export async function triggerPizzaAlarm(
  eventId: string,
  eventSlug: string,
  adminCode?: string | null
) {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) return authError;

  const pizza_alarm_at = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("events")
    .update({ pizza_alarm_at })
    .eq("id", eventId)
    .select("id, pizza_alarm_at, slug")
    .maybeSingle();

  if (error) {
    console.error("[triggerPizzaAlarm] Error:", error);
    return { error: "Failed to trigger pizza alarm" };
  }

  if (!data) {
    console.error("[triggerPizzaAlarm] No event updated for id:", eventId);
    return { error: "Event not found — pizza alarm was not saved" };
  }

  // Proven attendee delivery path: announcements INSERT is already wired in EventHeader.
  const { error: announcementError } = await supabase.from("announcements").insert({
    event_id: eventId,
    content: PIZZA_ALARM_ANNOUNCEMENT,
    priority: 10,
    published_at: pizza_alarm_at,
    expires_at: expiresAt,
  });

  if (announcementError) {
    console.error("[triggerPizzaAlarm] Announcement insert failed:", announcementError);
    return { error: "Alarm saved but failed to notify attendees" };
  }

  fanOutNotification(
    eventId,
    "announcement",
    "Pizza has arrived",
    PIZZA_ALARM_ANNOUNCEMENT,
    `/${data.slug || eventSlug}`
  ).catch(() => {});

  revalidatePath(`/${eventSlug}`);
  return { success: true as const, pizza_alarm_at: data.pizza_alarm_at as string };
}
