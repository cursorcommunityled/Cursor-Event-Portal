import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

const ASSIGNMENT_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=5, stale-while-revalidate=15",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }

    const session = await getSession();
    if (!session || session.eventId !== eventId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("seating_enabled")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!event.seating_enabled) {
      return NextResponse.json(
        { qrAssignment: null, smartAssignment: null },
        { headers: ASSIGNMENT_CACHE_HEADERS }
      );
    }

    // QR-based table registration (default seat)
    const { data: qrRegistration, error: qrError } = await supabase
      .from("table_registrations")
      .select("id, table_number")
      .eq("event_id", eventId)
      .eq("user_id", session.userId)
      .maybeSingle();

    if (qrError) {
      console.error("[table-assignment] QR registration error:", qrError);
    }

    const qrAssignment = qrRegistration
      ? {
          id: qrRegistration.id,
          tableNumber: qrRegistration.table_number,
        }
      : null;

    // Smart seating assignment (AI groups)
    // First get all group memberships for this user
    const { data: memberships, error } = await supabase
      .from("suggested_group_members")
      .select(`
        group_id,
        group:suggested_groups(
          id,
          name,
          table_number,
          status,
          event_id
        )
      `)
      .eq("user_id", session.userId);

    if (error || !memberships || memberships.length === 0) {
      return NextResponse.json(
        { qrAssignment, smartAssignment: null },
        { headers: ASSIGNMENT_CACHE_HEADERS }
      );
    }

    // Find the group that matches the event and is approved with a table number
    let matchingGroup: {
      id: string;
      name: string;
      table_number: number | null;
      status: string;
      event_id: string;
    } | null = null;

    for (const membership of memberships) {
      const groupData = membership.group;
      if (!groupData) continue;

      // Handle both array and object formats from Supabase
      const group = Array.isArray(groupData) ? groupData[0] : groupData;

      if (group && group.event_id === eventId && group.status === "approved" && group.table_number) {
        matchingGroup = group;
        break;
      }
    }

    if (!matchingGroup) {
      return NextResponse.json(
        { qrAssignment, smartAssignment: null },
        { headers: ASSIGNMENT_CACHE_HEADERS }
      );
    }

    const group = matchingGroup;

    return NextResponse.json(
      {
        qrAssignment,
        smartAssignment: {
          tableNumber: group.table_number,
          groupName: group.name,
          groupId: group.id,
        },
      },
      { headers: ASSIGNMENT_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("Table assignment lookup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
