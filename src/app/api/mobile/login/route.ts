import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyCheckInToken } from "@/lib/auth/checkin-token";
import {
  serializePortalSession,
} from "@/lib/auth/portal-session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, attendeeId, guest, checkInToken } = body;

    if (!eventId || !attendeeId) {
      return NextResponse.json(
        { error: "Missing eventId or attendeeId" },
        { status: 400 }
      );
    }

    if (!verifyCheckInToken(checkInToken, eventId, attendeeId)) {
      return NextResponse.json(
        { error: "Check-in authorization required" },
        { status: 401 }
      );
    }

    const supabase = await createServiceClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", attendeeId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }

    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select("id, checked_in_at, source")
      .eq("event_id", eventId)
      .eq("user_id", attendeeId)
      .single();

    if (regError || !registration) {
      return NextResponse.json(
        { error: "No registration found for this event" },
        { status: 404 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        "id, slug, name, venue, address, start_time, end_time, status, is_hackathon, seating_enabled, seat_lockout_active, survey_popup_visible, timer_label, timer_end_time, timer_active, pizza_alarm_at, timezone"
      )
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Optional guest registration (same as web checkin)
    if (guest?.name) {
      let guestUserId: string | undefined;

      if (guest.email) {
        const { data: existingGuest } = await supabase
          .from("users")
          .select("id")
          .eq("email", guest.email.toLowerCase())
          .single();

        if (existingGuest) {
          guestUserId = existingGuest.id;
        } else {
          const { data: newGuest } = await supabase
            .from("users")
            .insert({
              name: guest.name,
              email: guest.email.toLowerCase(),
              role: "attendee",
            })
            .select("id")
            .single();
          guestUserId = newGuest?.id;
        }
      } else {
        const { data: newGuest } = await supabase
          .from("users")
          .insert({ name: guest.name, role: "attendee" })
          .select("id")
          .single();
        guestUserId = newGuest?.id;
      }

      if (guestUserId) {
        const { data: existingGuestReg } = await supabase
          .from("registrations")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", guestUserId)
          .single();

        if (!existingGuestReg) {
          await supabase.from("registrations").insert({
            event_id: eventId,
            user_id: guestUserId,
            source: "walk-in",
          });
        }
      }
    }

    const session = {
      eventId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const token = serializePortalSession(session);

    return NextResponse.json({
      success: true,
      token,
      user,
      registration,
      event,
    });
  } catch (error) {
    console.error("[mobile/login]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
