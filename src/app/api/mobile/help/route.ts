import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import {
  createHelpRequest,
  cancelHelpRequest,
} from "@/lib/actions/help";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const body = await request.json();
    const { action } = body as { action?: string };

    if (action === "create") {
      const { eventId, eventSlug, category, description } = body;
      if (!eventId || !eventSlug || !category || !description) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      const result = await createHelpRequest(eventId, eventSlug, {
        category,
        description,
      });
      return NextResponse.json(result);
    }

    if (action === "cancel") {
      const { requestId, eventId, eventSlug } = body;
      if (!requestId || !eventId || !eventSlug) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      const result = await cancelHelpRequest(requestId, eventId, eventSlug);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
