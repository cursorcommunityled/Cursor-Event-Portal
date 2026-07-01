"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { fetchAllLumaGuests, syncLumaGuestToPortal } from "@/lib/luma";

export interface LumaSyncSummary {
  total: number;
  created: number;
  checkedIn: number;
  creditsAssigned: number;
  skipped: number;
  noCodesLeft: boolean;
  error?: string;
}

export async function saveLumaEventId(
  eventId: string,
  lumaEventIdRaw: string,
  adminCode: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createServiceClient();
  const lumaEventId = lumaEventIdRaw.trim() || null;

  const { error } = await supabase
    .from("events")
    .update({ luma_event_id: lumaEventId })
    .eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/${adminCode}/checkin`);
  return { success: true };
}

// Pulls the full guest list from Luma and reconciles it into the portal.
// Backstop for any webhook deliveries that were missed — fully replaces the
// manual CSV export/import flow.
export async function syncLumaGuests(
  eventId: string,
  adminCode: string
): Promise<LumaSyncSummary> {
  const summary: LumaSyncSummary = {
    total: 0,
    created: 0,
    checkedIn: 0,
    creditsAssigned: 0,
    skipped: 0,
    noCodesLeft: false,
  };

  const supabase = await createServiceClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, luma_event_id")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return { ...summary, error: "Event not found" };
  }
  if (!event.luma_event_id) {
    return { ...summary, error: "No Luma event ID linked — save one first" };
  }

  let guests;
  try {
    guests = await fetchAllLumaGuests(event.luma_event_id);
  } catch (err) {
    return { ...summary, error: err instanceof Error ? err.message : "Luma API request failed" };
  }

  summary.total = guests.length;
  const errors: string[] = [];

  for (const guest of guests) {
    const result = await syncLumaGuestToPortal(supabase, eventId, guest);
    if (result.status === "error") {
      errors.push(result.error ?? "unknown error");
      continue;
    }
    if (result.status === "skipped") summary.skipped++;
    if (result.status === "created") summary.created++;
    if (result.checkedIn) summary.checkedIn++;
    if (result.creditAssigned) summary.creditsAssigned++;
    if (result.noCodesLeft) summary.noCodesLeft = true;
  }

  if (errors.length > 0) {
    summary.error = `${errors.length} guest(s) failed: ${errors[0]}`;
  }

  revalidatePath(`/admin/${adminCode}/checkin`);
  return summary;
}
