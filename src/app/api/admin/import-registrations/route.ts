import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, attendees } = body;

    if (!eventId || !attendees || !Array.isArray(attendees)) {
      return NextResponse.json(
        { error: "Missing eventId or attendees" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check for admin code in header (alternative to session auth)
    const adminCode = request.headers.get("x-admin-code");
    const headerEventId = request.headers.get("x-event-id");

    if (adminCode && headerEventId) {
      // Validate admin code against event
      const { data: event } = await supabase
        .from("events")
        .select("admin_code")
        .eq("id", headerEventId)
        .single();

      if (!event || event.admin_code !== adminCode) {
        return NextResponse.json({ error: "Invalid admin code" }, { status: 403 });
      }
      // Admin code is valid, proceed
    } else {
      // Fall back to session auth
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("portal_session");
      if (!sessionCookie) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      let session;
      try {
        session = JSON.parse(sessionCookie.value);
      } catch {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }

      // Verify admin role
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.userId)
        .single();

      if (!user || user.role !== "admin") {
        // Log details server-side; never echo userIds/roles to the client.
        console.error("[import-registrations] Admin check failed", {
          hasUser: !!user,
          userError: userError?.message,
        });
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }
    }

    // Verify event exists
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const attendee of attendees) {
      const { name, email } = attendee;

      if (!name || !email) {
        errors.push(`Invalid attendee data: ${JSON.stringify(attendee)}`);
        continue;
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .single();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new user
        const { data: newUser, error: userError } = await supabase
          .from("users")
          .insert({
            name: name.trim(),
            email: normalizedEmail,
            role: "attendee",
          })
          .select("id")
          .single();

        if (userError || !newUser) {
          errors.push(`Failed to create user for ${email}: ${userError?.message}`);
          continue;
        }

        userId = newUser.id;
      }

      // Check if registration already exists
      const { data: existingReg } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .single();

      if (existingReg) {
        skipped++;
        continue;
      }

      // Create registration
      const { error: regError } = await supabase.from("registrations").insert({
        event_id: eventId,
        user_id: userId,
        source: "link", // Using 'link' as source type (valid: qr, link, walk-in)
      });

      if (regError) {
        errors.push(`Failed to register ${email}: ${regError.message}`);
        continue;
      }

      imported++;
    }

    return NextResponse.json({
      imported,
      skipped,
      errors: errors.slice(0, 10), // Limit errors returned
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

