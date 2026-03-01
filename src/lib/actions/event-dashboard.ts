"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Theme Selection ──────────────────────────────────────────────────────────

export async function selectEventTheme(
  eventId: string,
  themeId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("event_theme_selections")
    .upsert(
      { event_id: eventId, theme_id: themeId, selected_at: new Date().toISOString() },
      { onConflict: "event_id" }
    );
  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return { success: true };
}

export async function clearEventTheme(eventId: string, adminCode: string) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("event_theme_selections")
    .delete()
    .eq("event_id", eventId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return { success: true };
}

// ─── Planned Events (Planning Calendar) ──────────────────────────────────────

export async function createPlannedEvent(data: {
  title: string;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
  address?: string | null;
  notes?: string | null;
  confirmed?: boolean;
}) {
  const supabase = await createServiceClient();
  const { data: row, error } = await supabase
    .from("planned_events")
    .insert({ ...data })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true, data: row };
}

export async function updatePlannedEvent(
  id: string,
  data: Partial<{
    title: string;
    event_date: string;
    start_time: string | null;
    end_time: string | null;
    venue: string | null;
    address: string | null;
    notes: string | null;
    confirmed: boolean;
  }>
) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("planned_events")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function deletePlannedEvent(id: string) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("planned_events")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}
