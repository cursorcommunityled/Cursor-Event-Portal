import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createCheckInToken } from "@/lib/auth/checkin-token";
import {
  parsePortalSession,
  PORTAL_SESSION_COOKIE_NAME,
} from "@/lib/auth/portal-session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, email, userId } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing eventId" },
        { status: 400 }
      );
    }

    // If neither email nor userId provided, check for session
    if (!email && !userId) {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get(PORTAL_SESSION_COOKIE_NAME);

      if (sessionCookie) {
        const session = parsePortalSession(sessionCookie.value);
        // Check if session is valid and matches this event
        if (session && session.eventId === eventId) {
          // Use userId from session
          const supabase = await createServiceClient();
          const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, name, email")
            .eq("id", session.userId)
            .single();

          if (!userError && user) {
            // Check if they have a registration for this event
            const { data: registration, error: regError } = await supabase
              .from("registrations")
              .select("id, checked_in_at")
              .eq("event_id", eventId)
              .eq("user_id", user.id)
              .single();

            if (!regError && registration) {
              return registrationResponse(user, !!registration.checked_in_at);
            }
          }
        }
      }
    }

    // If email provided, use email lookup
    if (email) {
      const supabase = await createServiceClient();

      // Look up user by email (exact match, case-insensitive)
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, name, email")
        .ilike("email", email.trim())
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { found: false, error: "No registration found for this email" },
          { status: 404 }
        );
      }

      // Check if they have a registration for this event
      const { data: registration, error: regError } = await supabase
        .from("registrations")
        .select("id, checked_in_at")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      if (regError || !registration) {
        return NextResponse.json(
          { found: false, error: "No registration found for this event" },
          { status: 404 }
        );
      }

      return checkInLookupResponse(eventId, user, !!registration.checked_in_at);
    }

    // If userId provided, only allow it for the existing attendee session.
    if (userId) {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get(PORTAL_SESSION_COOKIE_NAME);
      const session = parsePortalSession(sessionCookie?.value);
      const validSession =
        session !== null && session.userId === userId && session.eventId === eventId;

      if (!validSession) {
        return NextResponse.json(
          { found: false, error: "Valid attendee session required" },
          { status: 401 }
        );
      }

      const supabase = await createServiceClient();
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { found: false, error: "No user found" },
          { status: 404 }
        );
      }

      // Check if they have a registration for this event
      const { data: registration, error: regError } = await supabase
        .from("registrations")
        .select("id, checked_in_at")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      if (regError || !registration) {
        return NextResponse.json(
          { found: false, error: "No registration found for this event" },
          { status: 404 }
        );
      }

      return registrationResponse(user, !!registration.checked_in_at);
    }

    // If we get here, no email, userId, or valid session was provided
    return NextResponse.json(
      { found: false, error: "No registration found. Please enter your email or ensure you are logged in." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function registrationResponse(
  user: { id: string; name: string; email: string | null },
  alreadyCheckedIn: boolean
) {
  return NextResponse.json({
    found: true,
    alreadyCheckedIn,
    attendee: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}

function checkInLookupResponse(
  eventId: string,
  user: { id: string; name: string; email: string | null },
  alreadyCheckedIn: boolean
) {
  return NextResponse.json({
    found: true,
    alreadyCheckedIn,
    attendee: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    checkInToken: createCheckInToken(eventId, user.id),
  });
}
