import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createCheckInToken } from "@/lib/auth/checkin-token";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, email } = body as { eventId?: string; email?: string };

    if (!eventId || !email?.trim()) {
      return NextResponse.json(
        { found: false, error: "Missing eventId or email" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

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

    return NextResponse.json({
      found: true,
      alreadyCheckedIn: !!registration.checked_in_at,
      attendee: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      checkInToken: createCheckInToken(eventId, user.id),
    });
  } catch (error) {
    console.error("[mobile/lookup]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
