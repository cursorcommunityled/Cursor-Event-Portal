import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import { submitSurveyResponse } from "@/lib/actions/survey";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async () => {
    const body = await request.json();
    const result = await submitSurveyResponse(
      body.surveyId,
      body.eventSlug,
      body.answers
    );
    return NextResponse.json(result);
  });
}
