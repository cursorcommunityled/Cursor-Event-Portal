import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import { votePoll } from "@/lib/actions/polls";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const { pollId, optionIndex, eventSlug } = await request.json();
    if (!pollId || optionIndex === undefined || !eventSlug) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const result = await votePoll(pollId, optionIndex, eventSlug);
    return NextResponse.json(result);
  });
}
