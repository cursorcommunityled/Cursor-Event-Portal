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

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ pizza_alarm_at: new Date().toISOString() })
    .eq("id", eventId);

  if (error) {
    console.error("[triggerPizzaAlarm] Error:", error);
    return { error: "Failed to trigger pizza alarm" };
  }

  revalidatePath(`/${eventSlug}`);
  return { success: true };
}
