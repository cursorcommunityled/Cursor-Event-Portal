import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

// Create a temporary session for pre-event intake completion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, email } = body;

    if (!eventId || !email) {
      return NextResponse.json(
        { error: "Missing eventId or email" },
        { status: 400 }
      );
    }

    // Throttle email-enumeration attempts against this endpoint.
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`pre-intake:ip:${ip}`, { limit: 20, windowMs: 60_000 });
    const emailLimit = rateLimit(`pre-intake:email:${String(email).toLowerCase()}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!ipLimit.ok || !emailLimit.ok) {
      const retryAfter = Math.max(
        ipLimit.ok ? 0 : ipLimit.retryAfterSeconds,
        emailLimit.ok ? 0 : emailLimit.retryAfterSeconds
      );
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const supabase = await createServiceClient();

    // Look up user by email
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .ilike("email", email.trim())
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "No registration found for this email" },
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
        { error: "No registration found for this event" },
        { status: 404 }
      );
    }

    // Create temporary session for intake (even if not checked in)
    const session = {
      eventId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    };

    const cookieStore = await cookies();
    cookieStore.set("portal_session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return NextResponse.json({ success: true, checkedIn: !!registration.checked_in_at });
  } catch (error) {
    console.error("Pre-event intake error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

