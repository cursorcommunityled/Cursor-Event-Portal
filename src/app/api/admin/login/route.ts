import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

// Health check for debugging
export async function GET() {
  return NextResponse.json({ status: "ok", route: "admin/login" });
}

// Admin login API route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Rate limit by IP and by email so brute-force / enumeration attempts
    // get throttled even when the attacker rotates one of the two.
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`admin-login:ip:${ip}`, { limit: 10, windowMs: 60_000 });
    const emailLimit = rateLimit(`admin-login:email:${String(email).toLowerCase()}`, {
      limit: 5,
      windowMs: 5 * 60_000,
    });
    if (!ipLimit.ok || !emailLimit.ok) {
      const retryAfter = Math.max(
        ipLimit.ok ? 0 : ipLimit.retryAfterSeconds,
        emailLimit.ok ? 0 : emailLimit.retryAfterSeconds
      );
      return NextResponse.json(
        { error: "Too many login attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const supabase = await createClient();

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email, role")
      .ilike("email", email.trim())
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const isAdmin = user.role === "admin";

    // Find an event they're registered for (admins can fall back to any active event)
    const { data: registration } = await supabase
      .from("registrations")
      .select("event_id, events(slug, admin_code)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    let eventId: string;
    let eventSlug: string;
    let adminCode: string;

    if (registration && registration.events) {
      eventId = registration.event_id;
      // Handle both array and single object responses from Supabase
      const eventData = Array.isArray(registration.events)
        ? registration.events[0]
        : registration.events;
      eventSlug = (eventData as { slug: string; admin_code: string }).slug;
      adminCode = (eventData as { slug: string; admin_code: string }).admin_code;
    } else if (isAdmin) {
      // Admin fallback: find any event (published, active, or draft)
      const { data: anyEvent } = await supabase
        .from("events")
        .select("id, slug, admin_code")
        .in("status", ["published", "active", "draft"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!anyEvent) {
        return NextResponse.json(
          { error: "No events found. Please create an event first." },
          { status: 404 }
        );
      }

      eventId = anyEvent.id;
      eventSlug = anyEvent.slug;
      adminCode = anyEvent.admin_code;

      // Create registration for admin (ignore if already exists)
      await supabase.from("registrations").upsert({
        event_id: eventId,
        user_id: user.id,
        source: "link",
        checked_in_at: new Date().toISOString(),
      }, { onConflict: "event_id,user_id", ignoreDuplicates: true });
    } else {
      return NextResponse.json(
        { error: "No registration found for this user." },
        { status: 403 }
      );
    }

    // Set session cookie with exp field for getSession() compatibility
    const session = {
      eventId,
      userId: user.id,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week
    };

    const response = NextResponse.json({
      success: true,
      eventSlug,
      adminCode: isAdmin ? adminCode : null,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set("portal_session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
