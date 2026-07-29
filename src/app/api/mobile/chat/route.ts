import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import {
  attendeeChat,
  getSuggestedChatQuestions,
} from "@/lib/actions/attendee-chat";

export async function GET(request: NextRequest) {
  return withMobileSession(request, async () => {
    const slug = request.nextUrl.searchParams.get("eventSlug");
    if (!slug) {
      return NextResponse.json({ error: "Missing eventSlug" }, { status: 400 });
    }
    const suggestions = await getSuggestedChatQuestions(slug);
    return NextResponse.json({ suggestions });
  });
}

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const body = await request.json();
    if (!body.eventSlug || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const result = await attendeeChat(body.eventSlug, body.messages);
    return NextResponse.json(result);
  });
}
