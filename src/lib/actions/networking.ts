"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AttendeeIntake } from "@/types";
import { NETWORKING_COLORS } from "@/lib/networking/colors";

const GOAL_LABELS: Record<string, string> = {
  "learn-ai": "AI/ML",
  "learn-coding": "coding",
  "networking": "networking",
  "find-cofounders": "co-founders",
  "hire-talent": "hiring",
  "find-job": "jobs",
  "explore-tools": "tools",
  "other": "general topics",
};

const OFFER_LABELS: Record<string, string> = {
  "ai-expertise": "AI expertise",
  "software-dev": "software development",
  "design": "design",
  "business-strategy": "business strategy",
  "funding-investment": "funding & investment",
  "mentorship": "mentorship",
  "collaboration": "collaboration",
  "other": "general knowledge",
};

// ── Pairing algorithm (deterministic, no LLM) ─────────────────────────────────

function scorePair(a: AttendeeIntake, b: AttendeeIntake): number {
  const aGoals = new Set<string>(a.goals);
  const bGoals = new Set<string>(b.goals);
  const aOffers = new Set<string>(a.offers);
  const bOffers = new Set<string>(b.offers);

  let score = 0;
  for (const g of aGoals) if (bOffers.has(g)) score += 3;
  for (const g of bGoals) if (aOffers.has(g)) score += 3;

  // role diversity bonus
  if (a.role_category && b.role_category && a.role_category !== b.role_category) score += 2;

  // experience spread bonus (pair juniors with seniors)
  const expA = a.years_experience ?? 0;
  const expB = b.years_experience ?? 0;
  if (Math.abs(expA - expB) >= 3) score += 1;

  return score;
}

function buildMatchReason(a: AttendeeIntake, b: AttendeeIntake): string {
  const aName = a.user?.name ?? "Attendee";
  const bName = b.user?.name ?? "Attendee";

  const aGoals = new Set<string>(a.goals);
  const bOffers = new Set<string>(b.offers);
  const bGoals = new Set<string>(b.goals);
  const aOffers = new Set<string>(a.offers);

  const aGetsFromB: string[] = [];
  for (const g of aGoals) {
    if (bOffers.has(g)) aGetsFromB.push(GOAL_LABELS[g] ?? g);
  }

  const bGetsFromA: string[] = [];
  for (const g of bGoals) {
    if (aOffers.has(g)) bGetsFromA.push(OFFER_LABELS[g] ?? g);
  }

  if (aGetsFromB.length > 0 && bGetsFromA.length > 0) {
    return `${bName} offers ${aGetsFromB[0]} which ${aName} wants; ${aName} offers ${bGetsFromA[0]} which ${bName} wants.`;
  }
  if (aGetsFromB.length > 0) {
    return `${bName} can speak to ${aGetsFromB.slice(0, 2).join(" & ")}, aligning with ${aName}'s goals.`;
  }
  if (bGetsFromA.length > 0) {
    return `${aName} can speak to ${bGetsFromA.slice(0, 2).join(" & ")}, aligning with ${bName}'s goals.`;
  }
  return `Complementary backgrounds — good opportunity to exchange perspectives.`;
}

interface PairingOutput {
  user1_id: string;
  user2_id: string | null;
  color_code: string;
  match_reason: string | null;
}

function buildPairings(
  intakes: AttendeeIntake[],
  pastPairKeys: Set<string>
): PairingOutput[] {
  if (intakes.length === 0) return [];
  if (intakes.length === 1) {
    return [{
      user1_id: intakes[0].user_id,
      user2_id: null,
      color_code: "gold",
      match_reason: null,
    }];
  }

  // Score all candidate pairs
  const candidates: { a: AttendeeIntake; b: AttendeeIntake; score: number }[] = [];
  for (let i = 0; i < intakes.length; i++) {
    for (let j = i + 1; j < intakes.length; j++) {
      const a = intakes[i];
      const b = intakes[j];
      const key = [a.user_id, b.user_id].sort().join(":");
      const pastPenalty = pastPairKeys.has(key) ? 100 : 0;
      candidates.push({ a, b, score: scorePair(a, b) - pastPenalty });
    }
  }
  candidates.sort((x, y) => y.score - x.score);

  // Greedy matching
  const assigned = new Set<string>();
  const pairs: { a: AttendeeIntake; b: AttendeeIntake }[] = [];

  for (const { a, b } of candidates) {
    if (assigned.has(a.user_id) || assigned.has(b.user_id)) continue;
    assigned.add(a.user_id);
    assigned.add(b.user_id);
    pairs.push({ a, b });
    if (pairs.length >= NETWORKING_COLORS.length) break;
  }

  // Handle odd person out — store as wildcard (no partner)
  const unassigned = intakes.filter((i) => !assigned.has(i.user_id));
  for (const solo of unassigned) {
    pairs.push({ a: solo, b: solo }); // sentinel: solo when a === b
  }

  // Build output with colors
  return pairs.map(({ a, b }, idx) => {
    const isSolo = a.user_id === b.user_id;
    const color = NETWORKING_COLORS[idx % NETWORKING_COLORS.length];
    return {
      user1_id: a.user_id,
      user2_id: isSolo ? null : b.user_id,
      color_code: color.id,
      match_reason: isSolo ? null : buildMatchReason(a, b),
    };
  });
}

// ── Server actions ────────────────────────────────────────────────────────────

export async function createNetworkingSession(
  eventId: string,
  roundDurationSeconds: number,
  adminCode: string
) {
  const supabase = await createServiceClient();

  // Delete any existing session for this event first
  await supabase
    .from("speed_networking_sessions")
    .delete()
    .eq("event_id", eventId);

  const { data, error } = await supabase
    .from("speed_networking_sessions")
    .insert({ event_id: eventId, round_duration_seconds: roundDurationSeconds })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/admin/${adminCode}/networking`);
  return { data };
}

export async function startNetworkingRound(
  sessionId: string,
  eventId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();

  // Fetch session
  const { data: session, error: sessionErr } = await supabase
    .from("speed_networking_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) return { error: "Session not found" };

  const nextRound = session.current_round + 1;

  // Fetch all checked-in registrations with their intakes
  const { data: registrations } = await supabase
    .from("registrations")
    .select("user_id, users(id, name, email)")
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null);

  const userIds = (registrations ?? []).map((r: any) => r.user_id);

  if (userIds.length < 2) {
    return { error: "Need at least 2 checked-in attendees to start a round" };
  }

  // Fetch intakes for checked-in users
  const { data: intakeRows } = await supabase
    .from("attendee_intakes")
    .select("*, users(id, name, email)")
    .eq("event_id", eventId)
    .in("user_id", userIds);

  // For users without intake, create minimal intake objects
  const intakeMap = new Map((intakeRows ?? []).map((i: any) => [i.user_id, i]));
  const intakes: AttendeeIntake[] = userIds.map((uid: string) => {
    const reg = (registrations ?? []).find((r: any) => r.user_id === uid);
    const existing = intakeMap.get(uid);
    if (existing) return existing as AttendeeIntake;
    return {
      id: uid,
      event_id: eventId,
      user_id: uid,
      goals: [],
      goals_other: null,
      offers: [],
      offers_other: null,
      role_category: null,
      founder_stage: null,
      years_experience: null,
      degree_type: null,
      linkedin: null,
      github: null,
      website: null,
      intent: null,
      followup_consent: null,
      cursor_experience: null,
      skipped: true,
      created_at: new Date().toISOString(),
      user: reg?.users as any,
    } as AttendeeIntake;
  });

  // Fetch past pair keys for this session (to avoid repeat pairings)
  const { data: pastPairsRaw } = await supabase
    .from("speed_networking_pairs")
    .select("user1_id, user2_id")
    .eq("session_id", sessionId)
    .not("user2_id", "is", null);

  const pastPairKeys = new Set(
    (pastPairsRaw ?? []).map((p: any) =>
      [p.user1_id, p.user2_id].sort().join(":")
    )
  );

  // Generate pairings
  const pairings = buildPairings(intakes, pastPairKeys);

  if (pairings.length === 0) {
    return { error: "Could not generate any pairings" };
  }

  // Create the round record
  const now = new Date();
  const endsAt = new Date(now.getTime() + session.round_duration_seconds * 1000);

  const { data: round, error: roundErr } = await supabase
    .from("speed_networking_rounds")
    .insert({
      session_id: sessionId,
      round_number: nextRound,
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select()
    .single();

  if (roundErr || !round) return { error: "Failed to create round" };

  // Insert pairs
  const pairRows = pairings.map((p) => ({
    round_id: round.id,
    session_id: sessionId,
    user1_id: p.user1_id,
    user2_id: p.user2_id,
    color_code: p.color_code,
    match_reason: p.match_reason,
  }));

  const { error: pairErr } = await supabase
    .from("speed_networking_pairs")
    .insert(pairRows);

  if (pairErr) return { error: "Failed to insert pairs" };

  // Update session status and round number
  const { error: updateErr } = await supabase
    .from("speed_networking_sessions")
    .update({ status: "active", current_round: nextRound })
    .eq("id", sessionId);

  if (updateErr) return { error: "Failed to update session status" };

  revalidatePath(`/admin/${adminCode}/networking`);
  return { data: { round, pairCount: pairings.length } };
}

export async function endNetworkingRound(sessionId: string, adminCode: string) {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("speed_networking_sessions")
    .update({ status: "between_rounds" })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/${adminCode}/networking`);
  return { data: true };
}

export async function endNetworkingSession(sessionId: string, adminCode: string) {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("speed_networking_sessions")
    .update({ status: "ended" })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/${adminCode}/networking`);
  return { data: true };
}

export async function deleteNetworkingSession(sessionId: string, adminCode: string) {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("speed_networking_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/${adminCode}/networking`);
  return { data: true };
}
