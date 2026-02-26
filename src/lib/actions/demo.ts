"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { getEventBySlug } from "@/lib/supabase/queries";
import {
  getOrCreateDemoSettings,
  getDemoAvailability,
  syncDemoSlotsForWindow,
} from "@/lib/demo/service";

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

async function validateAdminAccess(
  eventId: string,
  adminCode?: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  const supabase = await createServiceClient();

  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .single();

    if (event && event.admin_code === adminCode) {
      return { valid: true };
    }
  }

  const session = await getSession();
  if (!session) {
    return { valid: false, error: "Not authenticated" };
  }

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || !["staff", "admin"].includes(user.role)) {
    return { valid: false, error: "Not authorized" };
  }

  return { valid: true };
}

export async function updateDemoSignupSettings(
  eventId: string,
  eventSlug: string,
  adminCode: string,
  data: {
    isEnabled: boolean;
    speakerName?: string;
    opensAtLocal: string;
    closesAtLocal: string;
    timezone: string;
  }
) {
  const auth = await validateAdminAccess(eventId, adminCode);
  if (!auth.valid) {
    return { error: auth.error };
  }

  const timezone = data.timezone || "America/Edmonton";
  let opensAt: string;
  let closesAt: string;
  try {
    opensAt = toUtcIso(data.opensAtLocal, timezone);
    closesAt = toUtcIso(data.closesAtLocal, timezone);
  } catch {
    return { error: "Invalid open or close time" };
  }

  if (new Date(closesAt) <= new Date(opensAt)) {
    return { error: "Close time must be after open time" };
  }

  const supabase = await createServiceClient();
  const { error: upsertError } = await supabase
    .from("demo_signup_settings")
    .upsert(
      {
        event_id: eventId,
        is_enabled: data.isEnabled,
        speaker_name: data.speakerName?.trim() || null,
        opens_at: opensAt,
        closes_at: closesAt,
      },
      { onConflict: "event_id" }
    );

  if (upsertError) {
    return { error: upsertError.message || "Failed to update demo settings" };
  }

  try {
    await syncDemoSlotsForWindow(eventId, opensAt, closesAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync demo slots";
    return { error: message };
  }

  revalidatePath(`/${eventSlug}/demos`);
  revalidatePath(`/admin/${adminCode}/demos`);
  revalidatePath(`/admin/${adminCode}`);
  return { success: true };
}

export async function bookDemoSlot(eventSlug: string, slotId: string) {
  const event = await getEventBySlug(eventSlug);
  if (!event) {
    return { error: "Event not found" };
  }

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("checked_in_at")
    .eq("event_id", event.id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!registration?.checked_in_at) {
    return { error: "You must be checked in before booking a demo slot." };
  }

  const settings = await getOrCreateDemoSettings(event);
  await syncDemoSlotsForWindow(event.id, settings.opens_at, settings.closes_at);

  const availability = getDemoAvailability(settings);
  if (!availability.is_open) {
    return { error: availability.message };
  }

  const { data: slot } = await supabase
    .from("demo_slots")
    .select("id")
    .eq("id", slotId)
    .eq("event_id", event.id)
    .maybeSingle();

  if (!slot) {
    return { error: "Demo slot not found for this event." };
  }

  const { error } = await supabase.from("demo_slot_signups").insert({
    event_id: event.id,
    slot_id: slotId,
    user_id: session.userId,
  });

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("demo_slot_signups_event_id_user_id_key")) {
        return { error: "You already booked a demo slot." };
      }
      if (error.message.includes("demo_slot_signups_slot_id_user_id_key")) {
        return { error: "You already booked this slot." };
      }
    }

    if (error.message.includes("Demo slot is full")) {
      return { error: "This slot is full." };
    }

    return { error: error.message || "Failed to book demo slot." };
  }

  revalidatePath(`/${eventSlug}/demos`);
  return { success: true };
}

export async function cancelMyDemoSlot(eventSlug: string) {
  const event = await getEventBySlug(eventSlug);
  if (!event) {
    return { error: "Event not found" };
  }

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("demo_slot_signups")
    .delete()
    .eq("event_id", event.id)
    .eq("user_id", session.userId);

  if (error) {
    return { error: error.message || "Failed to cancel slot booking." };
  }

  revalidatePath(`/${eventSlug}/demos`);
  return { success: true };
}
