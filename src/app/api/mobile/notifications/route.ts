import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getMyPreferences,
  updateMyPreferences,
} from "@/lib/actions/notifications";

export async function GET(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    const view = request.nextUrl.searchParams.get("view");
    if (view === "preferences") {
      const preferences = await getMyPreferences(
        session.userId,
        session.eventId
      );
      return NextResponse.json({ preferences });
    }
    const notifications = await getMyNotifications(
      session.userId,
      session.eventId
    );
    return NextResponse.json({ notifications });
  });
}

export async function POST(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    const body = await request.json();
    if (body.action === "mark-read") {
      return NextResponse.json(
        await markNotificationRead(body.id, session.userId)
      );
    }
    if (body.action === "mark-all-read") {
      return NextResponse.json(
        await markAllNotificationsRead(session.userId, session.eventId)
      );
    }
    if (body.action === "update-preferences") {
      return NextResponse.json(
        await updateMyPreferences(
          session.userId,
          session.eventId,
          body.patch ?? {}
        )
      );
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
