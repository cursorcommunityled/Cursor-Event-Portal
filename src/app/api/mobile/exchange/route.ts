import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import {
  createExchangePost,
  claimExchangePost,
  closeExchangePost,
} from "@/lib/actions/exchange";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const body = await request.json();
    const { action } = body as { action?: string };

    if (action === "create") {
      return NextResponse.json(
        await createExchangePost(body.eventId, body.eventSlug, {
          type: body.type,
          category: body.category,
          title: body.title,
        })
      );
    }

    if (action === "claim") {
      return NextResponse.json(
        await claimExchangePost(body.postId, body.eventId, body.eventSlug)
      );
    }

    if (action === "close") {
      return NextResponse.json(
        await closeExchangePost(body.postId, body.eventId, body.eventSlug)
      );
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
