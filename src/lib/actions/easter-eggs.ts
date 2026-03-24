"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { getEventBySlug } from "@/lib/supabase/queries";

const EASTER_EVENT_SLUG = "calgary-march-2026";

export interface EggRow {
  egg_id: string;
  label: string;
  credit_code: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
}

export async function fetchEasterEggs(eventId: string): Promise<EggRow[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("easter_egg_hunts")
    .select("egg_id, label, credit_code, claimed_by, claimed_at")
    .eq("event_id", eventId)
    .order("egg_id");
  return (data ?? []) as EggRow[];
}

export async function saveEggRewardCode(
  eventId: string,
  eggId: string,
  creditCode: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();
  const trimmed = creditCode.trim()
    .replace(/^https:\/\/cursor\.com\/referral\?code=/, "")
    .replace(/[^a-zA-Z0-9]/g, "");

  if (!trimmed) return { success: false, error: "Invalid code" };

  const { error } = await supabase
    .from("easter_egg_hunts")
    .update({ credit_code: trimmed })
    .eq("egg_id", eggId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function claimEasterEgg(
  eggId: string,
  eventSlug: string
): Promise<{ success: boolean; message: string }> {
  if (eventSlug !== EASTER_EVENT_SLUG) {
    return { success: false, message: "Easter eggs are not available for this event." };
  }

  if (!["egg_1", "egg_2", "egg_3"].includes(eggId)) {
    return { success: false, message: "Invalid egg." };
  }

  const session = await getSession();
  if (!session) {
    return { success: false, message: "Session expired — please refresh." };
  }

  const supabase = await createServiceClient();

  const event = await getEventBySlug(eventSlug);
  if (!event) return { success: false, message: "Event not found." };

  // Max 1 easter-egg ($50) credit per user per event
  const { count: existingEggCredits } = await supabase
    .from("cursor_credits")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("assigned_to", session.userId)
    .eq("amount_usd", 50);

  if ((existingEggCredits ?? 0) >= 1) {
    return {
      success: false,
      message: "🥚 You've already claimed your Easter egg credit! One per person.",
    };
  }

  const { data: egg } = await supabase
    .from("easter_egg_hunts")
    .select("egg_id, credit_code, claimed_by, claimed_at")
    .eq("egg_id", eggId)
    .eq("event_id", event.id)
    .single();

  if (!egg) {
    return { success: false, message: "Egg not found." };
  }

  if (egg.claimed_by === session.userId) {
    return { success: false, message: "✅ You already claimed this one!" };
  }

  if (egg.claimed_by) {
    return { success: false, message: "😢 Someone cracked this egg first! Keep hunting..." };
  }

  // Claim it — atomic update where claimed_by IS NULL (race guard)
  const { data: updated, error } = await supabase
    .from("easter_egg_hunts")
    .update({
      claimed_by: session.userId,
      claimed_at: new Date().toISOString(),
    })
    .eq("egg_id", eggId)
    .eq("event_id", event.id)
    .is("claimed_by", null)
    .select("credit_code")
    .maybeSingle();

  if (error) {
    console.error("[claimEasterEgg] update error:", error);
    return { success: false, message: "Something went wrong. Try again!" };
  }

  if (!updated) {
    return { success: false, message: "😢 Someone just beat you to it! Keep hunting..." };
  }

  // Use the pre-loaded real code if available, otherwise a placeholder
  const code = updated.credit_code || `EASTER_${eggId.toUpperCase()}_${Date.now()}`;
  await supabase.from("cursor_credits").insert({
    event_id: event.id,
    credit_code: code,
    amount_usd: 50,
    assigned_to: session.userId,
    assigned_at: new Date().toISOString(),
  });

  return { success: true, message: "🥚 Credit claimed! Check your Credits tab." };
}

export async function resetEasterEggs(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  // Unclaim all eggs but preserve the pre-loaded credit codes
  const { error: eggErr } = await supabase
    .from("easter_egg_hunts")
    .update({ claimed_by: null, claimed_at: null })
    .eq("event_id", eventId);

  if (eggErr) return { success: false, error: eggErr.message };

  // Delete egg-related cursor_credits for this event ($50 entries)
  const { error: creditErr } = await supabase
    .from("cursor_credits")
    .delete()
    .eq("event_id", eventId)
    .eq("amount_usd", 50);

  if (creditErr) return { success: false, error: creditErr.message };

  return { success: true };
}

export async function getMyClaimedEggs(eventSlug: string): Promise<string[]> {
  if (eventSlug !== EASTER_EVENT_SLUG) return [];

  const session = await getSession();
  if (!session) return [];

  const supabase = await createServiceClient();
  const event = await getEventBySlug(eventSlug);
  if (!event) return [];

  const { data } = await supabase
    .from("easter_egg_hunts")
    .select("egg_id")
    .eq("event_id", event.id)
    .eq("claimed_by", session.userId);

  return (data ?? []).map((r: { egg_id: string }) => r.egg_id);
}
