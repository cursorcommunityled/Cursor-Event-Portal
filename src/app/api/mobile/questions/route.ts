import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import {
  createQuestion,
  upvoteQuestion,
  createAnswer,
} from "@/lib/actions/questions";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const body = await request.json();
    const { action } = body as { action?: string };

    if (action === "create") {
      const { eventId, eventSlug, content, tags } = body;
      if (!eventId || !eventSlug || !content) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      const result = await createQuestion(eventId, eventSlug, {
        content,
        tags: tags ?? [],
      });
      return NextResponse.json(result);
    }

    if (action === "upvote") {
      const { questionId, eventSlug } = body;
      if (!questionId || !eventSlug) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      const result = await upvoteQuestion(questionId, eventSlug);
      return NextResponse.json(result);
    }

    if (action === "answer") {
      const { questionId, eventSlug, content } = body;
      if (!questionId || !eventSlug || !content) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      const result = await createAnswer(questionId, eventSlug, { content });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
