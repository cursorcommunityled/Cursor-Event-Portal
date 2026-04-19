import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const eventSlug = searchParams.get("eventSlug");

  try {
    const supabase = await createServiceClient();

    let targetEventId = eventId;

    if (eventSlug && !eventId) {
      const { data: event } = await supabase
        .from("events")
        .select("id, slug, name")
        .eq("slug", eventSlug)
        .single();

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      targetEventId = event.id;
    }

    if (!targetEventId) {
      return NextResponse.json({ error: "eventId or eventSlug required" }, { status: 400 });
    }

    const { data: allComps, error: allError } = await supabase
      .from("competitions")
      .select("id, title, status, event_id")
      .eq("event_id", targetEventId);

    const { data: activeComps, error: activeError } = await supabase
      .from("competitions")
      .select("id, title, status")
      .eq("event_id", targetEventId)
      .in("status", ["active", "voting", "ended"]);

    return NextResponse.json({
      success: true,
      eventId: targetEventId,
      all: {
        count: allComps?.length || 0,
        competitions: allComps?.map((c) => ({ id: c.id, title: c.title, status: c.status })),
        error: allError?.message,
      },
      activeOnly: {
        count: activeComps?.length || 0,
        competitions: activeComps?.map((c) => ({ id: c.id, title: c.title, status: c.status })),
        error: activeError?.message,
      },
    });
  } catch (err) {
    // Log full error server-side; don't leak internals to clients.
    console.error("[debug-competitions] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
