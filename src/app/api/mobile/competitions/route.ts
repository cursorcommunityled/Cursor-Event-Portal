import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import {
  submitEntry,
  castVote,
  updateEntry,
} from "@/lib/actions/competitions";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const body = await request.json();
    const { action } = body as { action?: string };

    if (action === "submit") {
      const { competitionId, eventSlug, ...data } = body;
      if (!competitionId || !eventSlug || !data.title || !data.repo_url) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      const result = await submitEntry(competitionId, eventSlug, data);
      return NextResponse.json(result);
    }

    if (action === "update") {
      const { entryId, eventSlug, ...data } = body;
      if (!entryId || !eventSlug) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      const result = await updateEntry(entryId, eventSlug, data);
      return NextResponse.json(result);
    }

    if (action === "vote") {
      const { competitionId, entryId, eventSlug, score } = body;
      if (!competitionId || !entryId || !eventSlug) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      const result = await castVote(
        competitionId,
        entryId,
        eventSlug,
        score ?? 1,
        false
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
