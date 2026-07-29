import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import { recordPageView } from "@/lib/actions/analytics";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const body = await request.json();
    const result = await recordPageView(
      body.eventId,
      body.pagePath,
      body.pageType ?? "other",
      body.options
    );
    return NextResponse.json(result ?? { success: true });
  });
}
