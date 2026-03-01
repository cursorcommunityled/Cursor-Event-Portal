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
  city: string;
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
    city: string;
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

// ─── Calendar Cities ──────────────────────────────────────────────────────────

export async function createEventCalendarCity(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "City name is required" };

  const supabase = await createServiceClient();

  // Get current max sort_order
  const { data: existing } = await supabase
    .from("event_calendar_cities")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (existing?.sort_order ?? 0) + 1;

  const { data: row, error } = await supabase
    .from("event_calendar_cities")
    .insert({ name: trimmed, sort_order: nextOrder })
    .select()
    .single();

  if (error) {
    // Unique constraint = city already exists
    if (error.code === "23505") return { error: "City already exists" };
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true, data: row };
}
