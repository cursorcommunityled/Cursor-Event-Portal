import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { withMobileSession } from "@/lib/auth/mobile-session";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    const body = await request.json();
    const { eventId, tableNumber } = body as {
      eventId?: string;
      tableNumber?: number;
    };

    if (!eventId || !tableNumber) {
      return NextResponse.json(
        { error: "Missing eventId or tableNumber" },
        { status: 400 }
      );
    }

    if (session.eventId !== eventId) {
      return NextResponse.json(
        { error: "Invalid session for event" },
        { status: 403 }
      );
    }

    if (!Number.isFinite(tableNumber) || tableNumber < 1) {
      return NextResponse.json(
        { error: "Invalid tableNumber" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    const { data: event } = await supabase
      .from("events")
      .select("seating_enabled")
      .eq("id", eventId)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!event.seating_enabled) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const { data: registration } = await supabase
      .from("registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", session.userId)
      .maybeSingle();

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase.from("table_registrations").upsert(
      {
        event_id: eventId,
        user_id: session.userId,
        table_number: tableNumber,
        source: "qr",
      },
      { onConflict: "event_id,user_id" }
    );

    if (error) {
      console.error("[mobile/qr-checkin]", error);
      return NextResponse.json(
        { error: "Failed to assign table" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tableNumber });
  });
}
