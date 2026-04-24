"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import type { AgendaItem } from "@/types";

/**
 * Authorise an agenda admin action. Accepts either:
 *   1. A `portal_session` cookie belonging to a user with role = 'admin', or
 *   2. The per-event `adminCode` matching the target event (URL-based auth
 *      used by /admin/[adminCode] pages, where attendees never have a
 *      portal_session for the admin user).
 *
 * Returns null on success, or an `{ error }` object the caller should bubble
 * up. Always fails closed.
 */
async function authoriseAgendaAdmin(
  eventId: string,
  adminCode?: string | null
): Promise<{ error: string } | null> {
  const supabase = await createServiceClient();

  // 1) Legacy portal_session cookie + admin role
  const session = await getSession();
  if (session) {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();
    if (user?.role === "admin") return null;
  }

  // 2) Per-event admin code (passed in from the /admin/[adminCode] URL)
  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .maybeSingle();
    if (event?.admin_code && event.admin_code === adminCode) return null;
  }

  return { error: "Not authenticated" };
}

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

export async function getEventsForImport(currentEventId: string): Promise<
  { id: string; name: string; slug: string; start_time: string | null; items: AgendaItem[] }[]
> {
  const session = await getSession();
  if (!session) return [];

  const supabase = await createServiceClient();

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();
  if (!user || user.role !== "admin") return [];

  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, start_time")
    .neq("id", currentEventId)
    .neq("status", "archived")
    .order("start_time", { ascending: false });
  if (!events || events.length === 0) return [];

  const { data: allItems } = await supabase
    .from("agenda_items")
    .select("*")
    .in("event_id", events.map((e: any) => e.id))
    .order("sort_order", { ascending: true });

  const itemsByEvent = new Map<string, AgendaItem[]>();
  for (const item of allItems ?? []) {
    if (!itemsByEvent.has(item.event_id)) itemsByEvent.set(item.event_id, []);
    itemsByEvent.get(item.event_id)!.push(item);
  }

  return events
    .map((e: any) => ({ ...e, items: itemsByEvent.get(e.id) ?? [] }))
    .filter((e: any) => e.items.length > 0);
}

export async function importAgendaFromEvent(
  sourceEventId: string,
  targetEventId: string,
  targetEventSlug: string,
  itemIds: string[]
) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();
  if (!user || user.role !== "admin") return { error: "Not authorized" };

  const { data: sourceItems } = await supabase
    .from("agenda_items")
    .select("*")
    .eq("event_id", sourceEventId)
    .in("id", itemIds)
    .order("sort_order", { ascending: true });
  if (!sourceItems || sourceItems.length === 0) return { error: "No items found" };

  const { data: existingItems } = await supabase
    .from("agenda_items")
    .select("sort_order")
    .eq("event_id", targetEventId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const baseOrder = existingItems && existingItems.length > 0 ? existingItems[0].sort_order + 1 : 0;

  const inserts = sourceItems.map((item: any, i: number) => ({
    event_id: targetEventId,
    title: item.title,
    description: item.description,
    location: item.location,
    speaker: item.speaker,
    image_url: item.image_url,
    start_time: null,
    end_time: null,
    sort_order: baseOrder + i,
  }));

  const { error } = await supabase.from("agenda_items").insert(inserts);
  if (error) return { error: "Failed to import items" };

  revalidatePath(`/admin/${targetEventSlug}/agenda`);
  revalidatePath(`/${targetEventSlug}/agenda`);
  return { success: true, count: inserts.length };
}

// Standard Calgary Cursor Meetup agenda template (times are in the event's timezone)
const MEETUP_TEMPLATE: Array<{
  title: string;
  description: string;
  speaker?: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}> = [
  {
    title: "Arrival & Mingle",
    description: "Get settled in, grab a drink, and connect with fellow builders.",
    startHour: 17,
    startMinute: 30,
    endHour: 18,
    endMinute: 0,
  },
  {
    title: "Intro to Cursor",
    description: "A quick overview of what Cursor can do and how to get the most out of tonight.",
    speaker: "Simon Loewen",
    startHour: 18,
    startMinute: 0,
    endHour: 18,
    endMinute: 10,
  },
  {
    title: "Speakers",
    description:
      "Hear from builders and experts in the community.",
    speaker: "Simon Loewen",
    startHour: 18,
    startMinute: 10,
    endHour: 18,
    endMinute: 30,
  },
  {
    title: "Build & Egg Hunt (Credits)",
    description:
      "Build your best idea with Cursor — and hunt for hidden $50 credit Cursor eggs scattered across the venue and this app. First to find wins!",
    startHour: 18,
    startMinute: 30,
    endHour: 20,
    endMinute: 0,
  },
  {
    title: "Demos & Networking",
    description:
      "Present what you built, watch live demos, and connect with the community.",
    startHour: 20,
    startMinute: 0,
    endHour: 20,
    endMinute: 30,
  },
];

// Convert a wall-clock time in a given IANA timezone to a UTC ISO string.
function zonedWallTimeToUtcIso(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timezone: string
): string {
  // Treat the wall time as if it were UTC, then correct by the timezone's offset at that instant.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  // Some locales render midnight as "24"; normalize.
  const tzHour = get("hour") % 24;
  const tzAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), tzHour, get("minute"), get("second"));
  const offsetMs = tzAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs).toISOString();
}

export async function applyAgendaTemplate(
  eventId: string,
  eventSlug: string,
  adminCode?: string
) {
  const authError = await authoriseAgendaAdmin(eventId, adminCode);
  if (authError) return authError;

  const supabase = await createServiceClient();

  // Pull event so we can anchor times to the event's date in its own timezone.
  const { data: event } = await supabase
    .from("events")
    .select("id, start_time, timezone")
    .eq("id", eventId)
    .single();
  if (!event) return { error: "Event not found" };

  const timezone = event.timezone || "America/Edmonton";

  // Determine the event's local calendar date. Fall back to "today" in the event timezone.
  const baseUtc = event.start_time ? new Date(event.start_time) : new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseUtc);
  const get = (t: string) => Number(dateParts.find((p) => p.type === t)!.value);
  const year = get("year");
  const month = get("month");
  const day = get("day");

  // Don't clobber an existing agenda; append after the highest sort_order.
  const { data: existingItems } = await supabase
    .from("agenda_items")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const baseOrder =
    existingItems && existingItems.length > 0 ? existingItems[0].sort_order + 1 : 0;

  const inserts = MEETUP_TEMPLATE.map((tpl, i) => ({
    event_id: eventId,
    title: tpl.title,
    description: tpl.description,
    speaker: tpl.speaker ?? null,
    location: null,
    image_url: null,
    start_time: zonedWallTimeToUtcIso(year, month, day, tpl.startHour, tpl.startMinute, timezone),
    end_time: zonedWallTimeToUtcIso(year, month, day, tpl.endHour, tpl.endMinute, timezone),
    sort_order: baseOrder + i,
  }));

  const { error } = await supabase.from("agenda_items").insert(inserts);
  if (error) {
    console.error("Failed to apply agenda template:", error);
    return { error: "Failed to apply template" };
  }

  revalidatePath(`/admin/${eventSlug}/agenda`);
  revalidatePath(`/${eventSlug}/agenda`);
  return { success: true, count: inserts.length };
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

