/**
 * Post-event spare referral code sweep.
 * After a grace period, checks unassigned + assigned codes via Cursor API
 * and moves still-available codes into spare_referral_codes.
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  checkReferralCodes,
  referralUrlForCode,
  type ReferralCheckResult,
} from "@/lib/referral-checker";

export const SPARE_SWEEP_GRACE_DAYS = 14;

export type SweepSummary = {
  eventId: string;
  eventSlug: string;
  eventName: string;
  checked: number;
  moved: number;
  used: number;
  invalid: number;
  errorCount: number;
  skippedGrace: boolean;
  alreadySwept: boolean;
  errorMessage?: string;
};

type EventRow = {
  id: string;
  slug: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
};

type CreditRow = {
  id: string;
  credit_code: string;
  amount_usd: number;
  assigned_to: string | null;
};

function eventAnchorTime(event: EventRow): Date | null {
  const raw = event.end_time || event.start_time;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isPastGracePeriod(
  event: EventRow,
  now = new Date(),
  graceDays = SPARE_SWEEP_GRACE_DAYS
): boolean {
  const anchor = eventAnchorTime(event);
  if (!anchor) return false;
  const eligibleAt = new Date(anchor.getTime() + graceDays * 24 * 60 * 60 * 1000);
  return now >= eligibleAt;
}

export function graceEligibleAt(event: EventRow, graceDays = SPARE_SWEEP_GRACE_DAYS): Date | null {
  const anchor = eventAnchorTime(event);
  if (!anchor) return null;
  return new Date(anchor.getTime() + graceDays * 24 * 60 * 60 * 1000);
}

function isPlaceholderCode(code: string) {
  return code.toUpperCase().startsWith("EASTER_");
}

function countByStatus(results: ReferralCheckResult[]) {
  return results.reduce(
    (acc, r) => {
      if (r.status === "available") acc.available += 1;
      else if (r.status === "used") acc.used += 1;
      else if (r.status === "invalid") acc.invalid += 1;
      else acc.errorCount += 1;
      return acc;
    },
    { available: 0, used: 0, invalid: 0, errorCount: 0 }
  );
}

export async function sweepEventSpareCodes(
  eventId: string,
  options: { force?: boolean } = {}
): Promise<SweepSummary> {
  const supabase = await createServiceClient();
  const force = !!options.force;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, name, start_time, end_time")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    return {
      eventId,
      eventSlug: "",
      eventName: "",
      checked: 0,
      moved: 0,
      used: 0,
      invalid: 0,
      errorCount: 0,
      skippedGrace: false,
      alreadySwept: false,
      errorMessage: eventError?.message || "Event not found",
    };
  }

  const eventRow = event as EventRow;

  if (!force && !isPastGracePeriod(eventRow)) {
    return {
      eventId: eventRow.id,
      eventSlug: eventRow.slug,
      eventName: eventRow.name,
      checked: 0,
      moved: 0,
      used: 0,
      invalid: 0,
      errorCount: 0,
      skippedGrace: true,
      alreadySwept: false,
      errorMessage: `Grace period not over (wait ${SPARE_SWEEP_GRACE_DAYS} days after event end)`,
    };
  }

  const { data: existingSweep } = await supabase
    .from("event_credit_sweeps")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingSweep && !force) {
    return {
      eventId: eventRow.id,
      eventSlug: eventRow.slug,
      eventName: eventRow.name,
      checked: 0,
      moved: 0,
      used: 0,
      invalid: 0,
      errorCount: 0,
      skippedGrace: false,
      alreadySwept: true,
    };
  }

  const { data: credits, error: creditsError } = await supabase
    .from("cursor_credits")
    .select("id, credit_code, amount_usd, assigned_to")
    .eq("event_id", eventId);

  if (creditsError) {
    return {
      eventId: eventRow.id,
      eventSlug: eventRow.slug,
      eventName: eventRow.name,
      checked: 0,
      moved: 0,
      used: 0,
      invalid: 0,
      errorCount: 0,
      skippedGrace: false,
      alreadySwept: !!existingSweep,
      errorMessage: creditsError.message,
    };
  }

  const eligible = ((credits ?? []) as CreditRow[]).filter(
    (c) => c.credit_code && !isPlaceholderCode(c.credit_code)
  );

  if (eligible.length === 0) {
    const emptySummary: SweepSummary = {
      eventId: eventRow.id,
      eventSlug: eventRow.slug,
      eventName: eventRow.name,
      checked: 0,
      moved: 0,
      used: 0,
      invalid: 0,
      errorCount: 0,
      skippedGrace: false,
      alreadySwept: !!existingSweep,
    };
    await upsertSweepRecord(supabase, eventId, emptySummary);
    return emptySummary;
  }

  const checkResults = await checkReferralCodes(eligible.map((c) => c.credit_code));
  const byCode = new Map(checkResults.map((r) => [r.code, r]));
  const statusCounts = countByStatus(checkResults);

  let moved = 0;
  const nowIso = new Date().toISOString();

  for (const credit of eligible) {
    const result = byCode.get(credit.credit_code);
    if (!result || result.status !== "available") continue;

    const { error: upsertError } = await supabase.from("spare_referral_codes").upsert(
      {
        credit_code: credit.credit_code,
        referral_url: referralUrlForCode(credit.credit_code),
        amount_usd: credit.amount_usd,
        source_event_id: eventRow.id,
        source_event_slug: eventRow.slug,
        source_event_name: eventRow.name,
        was_assigned: !!credit.assigned_to,
        previous_assigned_to: credit.assigned_to,
        status_when_swept: "available",
        api_message: result.message || null,
        api_value: result.value || null,
        swept_at: nowIso,
      },
      { onConflict: "credit_code" }
    );

    if (upsertError) {
      console.error(
        `[spare-sweep] upsert failed for ${credit.credit_code}:`,
        upsertError.message
      );
      statusCounts.errorCount += 1;
      continue;
    }

    const { error: deleteError } = await supabase
      .from("cursor_credits")
      .delete()
      .eq("id", credit.id);

    if (deleteError) {
      console.error(
        `[spare-sweep] delete failed for ${credit.credit_code}:`,
        deleteError.message
      );
      statusCounts.errorCount += 1;
      continue;
    }

    moved += 1;
  }

  const summary: SweepSummary = {
    eventId: eventRow.id,
    eventSlug: eventRow.slug,
    eventName: eventRow.name,
    checked: eligible.length,
    moved,
    used: statusCounts.used,
    invalid: statusCounts.invalid,
    errorCount: statusCounts.errorCount,
    skippedGrace: false,
    alreadySwept: !!existingSweep,
  };

  await upsertSweepRecord(supabase, eventId, summary);
  return summary;
}

async function upsertSweepRecord(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  summary: Pick<
    SweepSummary,
    "checked" | "moved" | "used" | "invalid" | "errorCount"
  >
) {
  const payload = {
    event_id: eventId,
    swept_at: new Date().toISOString(),
    checked_count: summary.checked,
    moved_count: summary.moved,
    used_count: summary.used,
    invalid_count: summary.invalid,
    error_count: summary.errorCount,
  };

  const { error } = await supabase
    .from("event_credit_sweeps")
    .upsert(payload, { onConflict: "event_id" });

  if (error) {
    console.error("[spare-sweep] failed to record sweep:", error.message);
  }
}

export async function findEventsDueForSpareSweep(): Promise<EventRow[]> {
  const supabase = await createServiceClient();
  const now = new Date();

  const { data: sweeps } = await supabase.from("event_credit_sweeps").select("event_id");
  const sweptIds = new Set((sweeps ?? []).map((s) => s.event_id as string));

  const { data: events, error } = await supabase
    .from("events")
    .select("id, slug, name, start_time, end_time")
    .or("end_time.not.is.null,start_time.not.is.null");

  if (error) {
    console.error("[spare-sweep] failed to list events:", error.message);
    return [];
  }

  return ((events ?? []) as EventRow[]).filter((event) => {
    if (sweptIds.has(event.id)) return false;
    return isPastGracePeriod(event, now);
  });
}

export async function runSpareReferralCronSweep(): Promise<{
  processed: number;
  summaries: SweepSummary[];
}> {
  const due = await findEventsDueForSpareSweep();
  const summaries: SweepSummary[] = [];

  for (const event of due) {
    const summary = await sweepEventSpareCodes(event.id, { force: false });
    summaries.push(summary);
  }

  return { processed: summaries.length, summaries };
}
