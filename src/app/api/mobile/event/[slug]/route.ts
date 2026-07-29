import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: event, error } = await supabase
      .from("events")
      .select(
        "id, slug, name, venue, address, start_time, end_time, status, is_hackathon, seating_enabled, seat_lockout_active, survey_popup_visible, timer_label, timer_end_time, timer_active, pizza_alarm_at, timezone, venue_image_url"
      )
      .eq("slug", slug)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error("[mobile/event]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
