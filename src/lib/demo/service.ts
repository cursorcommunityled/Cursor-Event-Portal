import { createServiceClient } from "@/lib/supabase/server";
import type { DemoSignupSettings, DemoSlot, Event } from "@/types";

export interface DemoSlotWithCounts extends DemoSlot {
  signup_count: number;
  spots_left: number;
  is_full: boolean;
  attendees: Array<{ id: string; name: string; email: string | null }>;
}

export interface DemoAvailability {
  state: "disabled" | "upcoming" | "open" | "closed";
  is_open: boolean;
  message: string;
}

function getTimezoneOffset(timezone: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return utcDate.getTime() - tzDate.getTime();
}

function toUtcIso(localDateTime: string, timezone: string): string {
  const [datePart, timePart] = localDateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hours, minutes);
  const offset = getTimezoneOffset(timezone, localDate);
  return new Date(localDate.getTime() + offset).toISOString();
}

function getEventLocalDate(event: Event): { year: string; month: string; day: string } {
  const timezone = event.timezone || "America/Edmonton";
  const base = event.start_time ? new Date(event.start_time) : new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(base);
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return { year, month, day };
}

function buildDefaultWindow(event: Event): { opensAt: string; closesAt: string } {
  const timezone = event.timezone || "America/Edmonton";
  const { year, month, day } = getEventLocalDate(event);
  const opensAt = toUtcIso(`${year}-${month}-${day}T18:30`, timezone);
  const closesAt = toUtcIso(`${year}-${month}-${day}T20:00`, timezone);
  return { opensAt, closesAt };
}

export async function getOrCreateDemoSettings(event: Event): Promise<DemoSignupSettings> {
  const supabase = await createServiceClient();
  const { data: existing } = await supabase
    .from("demo_signup_settings")
    .select("*")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return existing as DemoSignupSettings;
  }

  const { opensAt, closesAt } = buildDefaultWindow(event);
  const { data: created, error } = await supabase
    .from("demo_signup_settings")
    .insert({
      event_id: event.id,
      is_enabled: true,
      speaker_name: null,
      opens_at: opensAt,
      closes_at: closesAt,
    })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(error?.message || "Failed to create demo signup settings");
  }

  return created as DemoSignupSettings;
}

export async function syncDemoSlotsForWindow(
  eventId: string,
  opensAt: string,
  closesAt: string
): Promise<void> {
  const supabase = await createServiceClient();
  const open = new Date(opensAt);
  const close = new Date(closesAt);

  if (Number.isNaN(open.getTime()) || Number.isNaN(close.getTime()) || close <= open) {
    throw new Error("Invalid demo signup window");
  }

  const slots: Array<{ event_id: string; starts_at: string; ends_at: string; capacity: number }> = [];
  const cursor = new Date(open);
  while (cursor < close) {
    const end = new Date(cursor.getTime() + 5 * 60 * 1000);
    slots.push({
      event_id: eventId,
      starts_at: cursor.toISOString(),
      ends_at: end.toISOString(),
      capacity: 2,
    });
    cursor.setMinutes(cursor.getMinutes() + 5);
  }

  if (slots.length > 0) {
    const { error: upsertError } = await supabase
      .from("demo_slots")
      .upsert(slots, { onConflict: "event_id,starts_at" });

    if (upsertError) {
      throw new Error(upsertError.message || "Failed to sync demo slots");
    }
  }

  await supabase.from("demo_slots").delete().eq("event_id", eventId).lt("starts_at", opensAt);
  await supabase.from("demo_slots").delete().eq("event_id", eventId).gte("starts_at", closesAt);
}

export function getDemoAvailability(settings: DemoSignupSettings): DemoAvailability {
  if (!settings.is_enabled) {
    return {
      state: "disabled",
      is_open: false,
      message: "Demo signup is currently disabled.",
    };
  }

  const now = new Date();
  const opensAt = new Date(settings.opens_at);
  const closesAt = new Date(settings.closes_at);

  if (now < opensAt) {
    return {
      state: "upcoming",
      is_open: false,
      message: "Demo signup has not opened yet.",
    };
  }

  if (now >= closesAt) {
    return {
      state: "closed",
      is_open: false,
      message: "Demo signup has closed for today.",
    };
  }

  return {
    state: "open",
    is_open: true,
    message: "Demo signup is open.",
  };
}

export async function getDemoSlotsWithCounts(eventId: string): Promise<DemoSlotWithCounts[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("demo_slots")
    .select("id, event_id, starts_at, ends_at, capacity, created_at, signups:demo_slot_signups(id, user:users(id, name, email))")
    .eq("event_id", eventId)
    .order("starts_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((slot) => {
    const attendees = ((slot.signups || []) as Array<{ user: { id: string; name: string; email: string | null } | null }>)
      .map((signup) => signup.user)
      .filter((user): user is { id: string; name: string; email: string | null } => !!user);

    const signupCount = attendees.length;
    const capacity = slot.capacity || 2;
    return {
      id: slot.id,
      event_id: slot.event_id,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      capacity,
      created_at: slot.created_at,
      signup_count: signupCount,
      spots_left: Math.max(0, capacity - signupCount),
      is_full: signupCount >= capacity,
      attendees,
    };
  });
}
