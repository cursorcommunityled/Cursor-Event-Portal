import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getDemoAvailability } from "@/lib/demo/service";
import type { DemoSignupSettings } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ enabled: false });

  try {
    const supabase = await createServiceClient();

    const { data: settings } = await supabase
      .from("demo_signup_settings")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (!settings || !settings.is_enabled) return NextResponse.json({ enabled: false });

    const availability = getDemoAvailability(settings as DemoSignupSettings);
    const now = new Date().toISOString();

    // Slot that is happening right now
    const { data: currentRaw } = await supabase
      .from("demo_slots")
      .select("id, starts_at, ends_at, capacity, signups:demo_slot_signups(user:users(id, name))")
      .eq("event_id", eventId)
      .lte("starts_at", now)
      .gt("ends_at", now)
      .maybeSingle();

    // Next 4 upcoming slots
    const { data: upcomingRaw } = await supabase
      .from("demo_slots")
      .select("id, starts_at, ends_at, capacity, signups:demo_slot_signups(user:users(id, name))")
      .eq("event_id", eventId)
      .gt("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(4);

    const processSlot = (slot: any) => {
      const attendees = (
        (slot.signups || []) as unknown as Array<{ user: { id: string; name: string } | null }>
      )
        .map((s) => s.user)
        .filter((u): u is { id: string; name: string } => !!u);
      const count = attendees.length;
      const cap = slot.capacity || 2;
      return {
        id: slot.id as string,
        starts_at: slot.starts_at as string,
        ends_at: slot.ends_at as string,
        capacity: cap,
        signup_count: count,
        spots_left: Math.max(0, cap - count),
        is_full: count >= cap,
        attendees,
      };
    };

    return NextResponse.json({
      enabled: true,
      availability,
      speakerName: settings.speaker_name ?? null,
      currentSlot: currentRaw ? processSlot(currentRaw) : null,
      upcomingSlots: (upcomingRaw || []).map(processSlot),
    });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
