"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireAnyAdmin, requireEventAdmin } from "@/lib/auth/admin-action";
import { revalidatePath } from "next/cache";
import {
  graceEligibleAt,
  isPastGracePeriod,
  SPARE_SWEEP_GRACE_DAYS,
  sweepEventSpareCodes,
  type SweepSummary,
} from "@/lib/spare-referral-sweep";
import type { SpareReferralCode, EventCreditSweep } from "@/types";

export type SpareReferralStats = {
  total: number;
  lastSweepAt: string | null;
  lastMovedCount: number;
  thisEventSweep: EventCreditSweep | null;
  graceDays: number;
  graceEligibleAt: string | null;
  pastGrace: boolean;
};

export async function fetchSpareReferralCodes(
  adminCode: string
): Promise<{ codes: SpareReferralCode[]; error?: string }> {
  const authError = await requireAnyAdmin(adminCode);
  if (authError) return { codes: [], error: authError.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("spare_referral_codes")
    .select("*")
    .order("swept_at", { ascending: false });

  if (error) return { codes: [], error: error.message };
  return { codes: (data ?? []) as SpareReferralCode[] };
}

export async function fetchSpareReferralStats(
  eventId: string,
  adminCode: string
): Promise<SpareReferralStats & { error?: string }> {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) {
    return {
      total: 0,
      lastSweepAt: null,
      lastMovedCount: 0,
      thisEventSweep: null,
      graceDays: SPARE_SWEEP_GRACE_DAYS,
      graceEligibleAt: null,
      pastGrace: false,
      error: authError.error,
    };
  }

  const supabase = await createServiceClient();

  const [{ count }, { data: lastSweep }, { data: thisSweep }, { data: event }] =
    await Promise.all([
      supabase
        .from("spare_referral_codes")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("event_credit_sweeps")
        .select("swept_at, moved_count")
        .order("swept_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("event_credit_sweeps")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle(),
      supabase
        .from("events")
        .select("id, slug, name, start_time, end_time")
        .eq("id", eventId)
        .maybeSingle(),
    ]);

  const eligibleAt = event
    ? graceEligibleAt({
        id: event.id,
        slug: event.slug,
        name: event.name,
        start_time: event.start_time,
        end_time: event.end_time,
      })
    : null;

  return {
    total: count ?? 0,
    lastSweepAt: lastSweep?.swept_at ?? null,
    lastMovedCount: lastSweep?.moved_count ?? 0,
    thisEventSweep: (thisSweep as EventCreditSweep | null) ?? null,
    graceDays: SPARE_SWEEP_GRACE_DAYS,
    graceEligibleAt: eligibleAt?.toISOString() ?? null,
    pastGrace: event
      ? isPastGracePeriod({
          id: event.id,
          slug: event.slug,
          name: event.name,
          start_time: event.start_time,
          end_time: event.end_time,
        })
      : false,
  };
}

export async function runSpareSweepForEvent(
  eventId: string,
  adminCode: string,
  options: { force?: boolean } = {}
): Promise<SweepSummary> {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) {
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
      errorMessage: authError.error,
    };
  }

  const summary = await sweepEventSpareCodes(eventId, { force: !!options.force });
  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return summary;
}
