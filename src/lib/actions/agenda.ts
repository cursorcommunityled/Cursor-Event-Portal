"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import type { AgendaItem } from "@/types";

export async function createAgendaItem(
  eventId: string,
  eventSlug: string,
  data: {
    title: string;
    description?: string | null;
    location?: string | null;
    speaker?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    sort_order?: number;
    image_url?: string | null;
  }
) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Verify user is admin
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { error: "Not authorized" };
  }

  // Get max sort_order for this event
  const { data: existingItems } = await supabase
    .from("agenda_items")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSortOrder = existingItems && existingItems.length > 0 
    ? existingItems[0].sort_order 
    : -1;

  const { data: item, error } = await supabase
    .from("agenda_items")
    .insert({
      event_id: eventId,
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      speaker: data.speaker || null,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      sort_order: data.sort_order ?? maxSortOrder + 1,
      image_url: data.image_url || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create agenda item:", error);
    return { error: "Failed to create agenda item" };
  }

  revalidatePath(`/admin/${eventSlug}/agenda`);
  revalidatePath(`/${eventSlug}/agenda`);
  return { success: true, item };
}

export async function updateAgendaItem(
  itemId: string,
  eventSlug: string,
  data: Partial<Omit<AgendaItem, "id" | "event_id" | "created_at">>
) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Verify user is admin
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("agenda_items")
    .update(data)
    .eq("id", itemId);

  if (error) {
    console.error("Failed to update agenda item:", error);
    return { error: "Failed to update agenda item" };
  }

  revalidatePath(`/admin/${eventSlug}/agenda`);
  revalidatePath(`/${eventSlug}/agenda`);
  return { success: true };
}

export async function updateEventDetails(
  eventId: string,
  eventSlug: string,
  data: {
    name?: string;
    venue?: string | null;
    address?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    venue_image_url?: string | null;
    capacity?: number;
  }
) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("events")
    .update(data)
    .eq("id", eventId);

  if (error) {
    console.error("Failed to update event details:", error);
    return { error: "Failed to update event details" };
  }

  revalidatePath(`/admin/${eventSlug}`);
  revalidatePath(`/admin/${eventSlug}/agenda`);
  revalidatePath(`/admin/${eventSlug}/checkin`);
  revalidatePath(`/${eventSlug}`);
  revalidatePath(`/${eventSlug}/agenda`);
  // Revalidate event layout so attendee pages (header, check-in, agenda) show updated venue/address/image
  revalidatePath(`/${eventSlug}`, "layout");
  return { success: true };
}

export async function deleteAgendaItem(itemId: string, eventSlug: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Verify user is admin
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("agenda_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("Failed to delete agenda item:", error);
    return { error: "Failed to delete agenda item" };
  }

  revalidatePath(`/admin/${eventSlug}/agenda`);
  revalidatePath(`/${eventSlug}/agenda`);
  return { success: true };
}

