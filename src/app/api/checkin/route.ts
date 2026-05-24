import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { autoAssignLateArrival } from "@/lib/actions/groups";
import { verifyCheckInToken } from "@/lib/auth/checkin-token";
import {
  PORTAL_SESSION_COOKIE_NAME,
  serializePortalSession,
} from "@/lib/auth/portal-session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, attendeeId, guest, skipCheckIn, checkInToken } = body;

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

    // Get the attendee (user) to verify they exist
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", attendeeId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Attendee not found" },
        { status: 404 }
      );
    }

    // Check if they have a registration for this event
    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select("id, checked_in_at")
      .eq("event_id", eventId)
      .eq("user_id", attendeeId)
      .single();

    if (regError || !registration) {
      return NextResponse.json(
        { error: "No registration found for this event" },
        { status: 404 }
      );
    }

    const shouldSkipCheckIn = !!skipCheckIn || !!registration.checked_in_at;

    // Update registration to checked in (only if not already checked in and not skipping)
    if (!shouldSkipCheckIn) {
      await supabase
        .from("registrations")
        .update({
          checked_in_at: new Date().toISOString(),
        })
        .eq("id", registration.id);
    }

    // If bringing a guest, create a guest registration
    if (guest && guest.name) {
      // Check if guest already exists by email
      let guestUserId: string;

      if (guest.email) {
        const { data: existingGuest } = await supabase
          .from("users")
          .select("id")
          .eq("email", guest.email.toLowerCase())
          .single();

        if (existingGuest) {
          guestUserId = existingGuest.id;
        } else {
          const { data: newGuest, error: guestError } = await supabase
            .from("users")
            .insert({
              name: guest.name,
              email: guest.email.toLowerCase(),
              role: "attendee",
            })
            .select("id")
            .single();

          if (guestError || !newGuest) {
            console.error("Failed to create guest user:", guestError);
          } else {
            guestUserId = newGuest.id;
          }
        }
      } else {
        // Guest without email - create new user
        const { data: newGuest, error: guestError } = await supabase
          .from("users")
          .insert({
            name: guest.name,
            role: "attendee",
          })
          .select("id")
          .single();

        if (guestError || !newGuest) {
          console.error("Failed to create guest user:", guestError);
        } else {
          guestUserId = newGuest.id;
        }
      }

      // Create guest registration if we have a user ID
      if (guestUserId!) {
        // Check if guest already registered
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
            source: "walk-in", // Guests are essentially walk-ins
            checked_in_at: new Date().toISOString(),
          });
        }
      }
    }

    // Create session cookie
    const session = {
      eventId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week
    };

    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE_NAME, serializePortalSession(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    // Auto-assign late arrivals to a table if seat lockout is active
    try {
      const assignment = await autoAssignLateArrival(eventId, attendeeId);
      if (assignment) {
        console.log(`[checkin] Late arrival auto-assigned: ${user.name} → ${assignment.groupName} (Table ${assignment.tableNumber})`);
      }
    } catch (assignErr) {
      // Non-fatal — check-in still succeeds even if auto-assign fails
      console.error("[checkin] Auto-assign failed (non-fatal):", assignErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Check-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

