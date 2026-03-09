import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { fanOutNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, content } = body;

    if (!eventId || !content) {
      return NextResponse.json(
        { error: "Missing eventId or content" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check for admin code in header (alternative to session auth)
    const adminCode = request.headers.get("x-admin-code");
    const headerEventId = request.headers.get("x-event-id");

    if (adminCode && headerEventId) {
      const { data: event } = await supabase
        .from("events")
        .select("admin_code")
        .eq("id", headerEventId)
        .single();

      if (!event || event.admin_code !== adminCode || headerEventId !== eventId) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    } else {
      // Fall back to session auth
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.userId)
        .single();

      if (userError) {
        console.error("User lookup error:", userError);
        return NextResponse.json(
          { error: "Failed to verify user" },
          { status: 500 }
        );
      }

      if (!user || user.role !== "admin") {
        console.error("Admin check failed:", {
          userId: session.userId,
          userFound: !!user,
          role: user?.role,
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

    // Create announcement with published_at set to now and expires in 2 minutes
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now
    
    const { data: announcement, error: insertError } = await supabase
      .from("announcements")
      .insert({
        event_id: eventId,
        content: content.trim(),
        priority: 0,
        published_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Announcement creation error:", insertError);
      return NextResponse.json(
        { error: "Failed to create announcement" },
        { status: 500 }
      );
    }

    // Fan-out in-app notification (fire-and-forget)
    const { data: eventFull } = await supabase.from("events").select("slug").eq("id", eventId).single();
    fanOutNotification(
      eventId,
      "announcement",
      "New Announcement",
      content.trim(),
      eventFull ? `/${eventFull.slug}` : undefined
    ).catch(() => {});

    return NextResponse.json(announcement);
  } catch (error) {
    console.error("Announcement POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
