import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import {
  fetchMyCredits,
  markCreditRedeemed,
} from "@/lib/actions/cursor-credits";

export async function GET(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    const credits = await fetchMyCredits(session.eventId, session.userId);
    return NextResponse.json({ credits });
  });
}

export async function POST(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    const body = await request.json();
    if (body.action === "redeem") {
      if (!body.creditId) {
        return NextResponse.json({ error: "Missing creditId" }, { status: 400 });
      }
      return NextResponse.json(
        await markCreditRedeemed(body.creditId)
      );
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
