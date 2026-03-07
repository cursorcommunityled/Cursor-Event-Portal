"use server";

import { createServiceClient } from "@/lib/supabase/server";
import type { ScheduledItem } from "@/types";

async function validateAdmin(eventId: string, adminCode: string) {
  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("admin_code")
    .eq("id", eventId)
    .single();
  return { valid: event?.admin_code === adminCode, supabase };
}

export async function getScheduledItems(
  eventId: string,
  adminCode: string
): Promise<ScheduledItem[]> {
  const { valid, supabase } = await validateAdmin(eventId, adminCode);
  if (!valid) return [];

  const { data } = await supabase
    .from("scheduled_items")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true });

  return (data || []) as ScheduledItem[];
}

export async function createScheduledAnnouncement(
  eventId: string,
  adminCode: string,
  content: string,
  scheduledAt: string
): Promise<{ success: boolean; error?: string; item?: ScheduledItem }> {
  const { valid, supabase } = await validateAdmin(eventId, adminCode);
  if (!valid) return { success: false, error: "Not authorized" };

  const { data, error } = await supabase
    .from("scheduled_items")
    .insert({ event_id: eventId, type: "announcement", content, scheduled_at: scheduledAt })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, item: data as ScheduledItem };
}

export async function createScheduledPoll(
  eventId: string,
  adminCode: string,
  question: string,
  options: string[],
  durationMinutes: number | null,
  scheduledAt: string
): Promise<{ success: boolean; error?: string; item?: ScheduledItem }> {
  const { valid, supabase } = await validateAdmin(eventId, adminCode);
  if (!valid) return { success: false, error: "Not authorized" };

  const { data, error } = await supabase
    .from("scheduled_items")
    .insert({
      event_id: eventId,
      type: "poll",
      poll_question: question,
      poll_options: options,
      poll_duration_minutes: durationMinutes,
      scheduled_at: scheduledAt,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, item: data as ScheduledItem };
}

export async function cancelScheduledItem(
  itemId: string,
  eventId: string,
  adminCode: string
): Promise<{ success: boolean; error?: string }> {
  const { valid, supabase } = await validateAdmin(eventId, adminCode);
  if (!valid) return { success: false, error: "Not authorized" };

  const { error } = await supabase
    .from("scheduled_items")
    .update({ status: "cancelled" })
    .eq("id", itemId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
