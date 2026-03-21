"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { getEventBySlug } from "@/lib/supabase/queries";

const EASTER_EVENT_SLUG = "calgary-march-2026";

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

  // Check current state of this egg
  const { data: egg } = await supabase
    .from("easter_egg_hunts")
    .select("egg_id, claimed_by, claimed_at")
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
    .select()
    .maybeSingle();

  if (error) {
    console.error("[claimEasterEgg] update error:", error);
    return { success: false, message: "Something went wrong. Try again!" };
  }

  if (!updated) {
    // Lost the race
    return { success: false, message: "😢 Someone just beat you to it! Keep hunting..." };
  }

  // Insert a cursor_credit placeholder so it shows in the Credits tab.
  // Admin will update the credit_code to the real referral code later.
  const placeholderCode = `EASTER_${eggId.toUpperCase()}_${Date.now()}`;
  await supabase.from("cursor_credits").insert({
    event_id: event.id,
    credit_code: placeholderCode,
    amount_usd: 50,
    assigned_to: session.userId,
    assigned_at: new Date().toISOString(),
  });

  return { success: true, message: "🥚 Credit claimed! Check your Credits tab." };
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
