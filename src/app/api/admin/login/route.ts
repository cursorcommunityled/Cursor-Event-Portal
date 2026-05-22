import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";
import {
  PORTAL_SESSION_COOKIE_NAME,
  serializePortalSession,
} from "@/lib/auth/portal-session";
import { isStaticAdminEmail } from "@/lib/auth/admin-allowlist";

// Health check for debugging
export async function GET() {
  return NextResponse.json({ status: "ok", route: "admin/login" });
}

// Admin login API route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;

    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser?.email) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    const email = authUser.email.trim().toLowerCase();

    if (requestedEmail && requestedEmail !== email) {
      return NextResponse.json(
        { error: "Signed-in user does not match requested email." },
        { status: 403 }
      );
    }

    // Rate limit by IP and by email so brute-force / enumeration attempts
    // get throttled even when the attacker rotates one of the two.
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`admin-login:ip:${ip}`, { limit: 10, windowMs: 60_000 });
    const emailLimit = rateLimit(`admin-login:email:${email}`, {
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

    const service = await createServiceClient();

    const [{ data: allowListed }, { data: existingUser }] = await Promise.all([
      service.from("admin_emails").select("email").ilike("email", email).maybeSingle(),
      service.from("users").select("id, name, email, role").ilike("email", email).limit(1).maybeSingle(),
    ]);

    const isAllowListed = Boolean(allowListed) || isStaticAdminEmail(email);

    if (!isAllowListed && existingUser?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    let user = existingUser;
    if (!user) {
      const metadataName = authUser.user_metadata?.name;
      const fallbackName = email.split("@")[0] || "Admin";
      const { data: newUser, error: createUserError } = await service
        .from("users")
        .insert({
          id: authUser.id,
          email,
          name: typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : fallbackName,
          role: "admin",
        })
        .select("id, name, email, role")
        .single();

      if (createUserError || !newUser) {
        return NextResponse.json(
          { error: "Failed to create admin profile." },
          { status: 500 }
        );
      }
      user = newUser;
    } else if (user.role !== "admin") {
      const { data: promotedUser, error: promoteError } = await service
        .from("users")
        .update({ role: "admin" })
        .eq("id", user.id)
        .select("id, name, email, role")
        .single();

      if (promoteError || !promotedUser) {
        return NextResponse.json(
          { error: "Failed to update admin profile." },
          { status: 500 }
        );
      }
      user = promotedUser;
    }

    // Find an event they're registered for (admins can fall back to any active event)
    const { data: registration } = await service
      .from("registrations")
      .select("event_id, events(slug, admin_code)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

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
    } else {
      // Admin fallback: find any event (published, active, or draft)
      const { data: anyEvent } = await service
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
    }

    // Set session cookie with exp field for getSession() compatibility
    const session = {
      eventId,
      userId: user.id,
      role: user.role,
      userName: user.name,
      userEmail: user.email,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week
    };

    const response = NextResponse.json({
      success: true,
      eventSlug,
      adminCode,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(PORTAL_SESSION_COOKIE_NAME, serializePortalSession(session), {
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
