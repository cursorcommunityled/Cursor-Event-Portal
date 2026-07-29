import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { withMobileSession } from "@/lib/auth/mobile-session";

export async function GET(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    const supabase = await createServiceClient();

    const [{ data: user }, { data: registration }, { data: event }] =
      await Promise.all([
        supabase
          .from("users")
          .select("id, name, email, role")
          .eq("id", session.userId)
          .single(),
        supabase
          .from("registrations")
          .select("id, checked_in_at, source")
          .eq("event_id", session.eventId)
          .eq("user_id", session.userId)
          .single(),
        supabase
          .from("events")
          .select(
            "id, slug, name, venue, address, start_time, end_time, status, is_hackathon, seating_enabled, seat_lockout_active, survey_popup_visible, timer_label, timer_end_time, timer_active, pizza_alarm_at, timezone"
          )
          .eq("id", session.eventId)
          .single(),
      ]);

    if (!user || !registration || !event) {
      return NextResponse.json({ error: "Session invalid" }, { status: 401 });
    }

    return NextResponse.json({ user, registration, event });
  });
}
