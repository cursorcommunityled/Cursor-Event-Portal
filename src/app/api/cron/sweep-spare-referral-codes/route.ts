import { NextRequest, NextResponse } from "next/server";
import { runSpareReferralCronSweep } from "@/lib/spare-referral-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily cron: reclaim still-available Cursor referral codes from events
 * past the 14-day post-event grace period into spare_referral_codes.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/sweep-spare-referral-codes] CRON_SECRET is not set; refusing to run.");
    return NextResponse.json(
      { error: "Endpoint disabled (missing CRON_SECRET)" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { processed, summaries } = await runSpareReferralCronSweep();
    const moved = summaries.reduce((n, s) => n + s.moved, 0);
    return NextResponse.json({
      processed,
      moved,
      summaries,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/sweep-spare-referral-codes]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
