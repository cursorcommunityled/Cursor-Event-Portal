import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import { bookDemoSlot, cancelMyDemoSlot } from "@/lib/actions/demo";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const body = await request.json();
    const { action } = body as { action?: string };

    if (action === "book") {
      if (!body.eventSlug || !body.slotId) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      return NextResponse.json(
        await bookDemoSlot(body.eventSlug, body.slotId)
      );
    }

    if (action === "cancel") {
      if (!body.eventSlug) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      return NextResponse.json(await cancelMyDemoSlot(body.eventSlug));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
