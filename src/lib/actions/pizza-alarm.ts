"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireEventAdmin } from "@/lib/auth/admin-action";

export async function triggerPizzaAlarm(
  eventId: string,
  eventSlug: string,
  adminCode?: string | null
) {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) return authError;

  const pizza_alarm_at = new Date().toISOString();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .update({ pizza_alarm_at })
    .eq("id", eventId)
    .select("id, pizza_alarm_at")
    .maybeSingle();

  if (error) {
    console.error("[triggerPizzaAlarm] Error:", error);
    return { error: "Failed to trigger pizza alarm" };
  }

  if (!data) {
    console.error("[triggerPizzaAlarm] No event updated for id:", eventId);
    return { error: "Event not found — pizza alarm was not saved" };
  }

  revalidatePath(`/${eventSlug}`);
  return { success: true as const, pizza_alarm_at: data.pizza_alarm_at as string };
}
