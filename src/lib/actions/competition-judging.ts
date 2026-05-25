"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { HACKATHON_SCORE_CATEGORIES } from "@/lib/hackathon-rubric";
import type {
  CompetitionEntry,
  CompetitionJudgingCriterion,
  CompetitionJudgingStanding,
  HackathonPrize,
} from "@/types";

const DEFAULT_JUDGING_CRITERIA = HACKATHON_SCORE_CATEGORIES.map((criterion, index) => ({
  slug: criterion.key.replace(/_/g, "-"),
  label: criterion.label,
  description: criterion.description,
  max_points: criterion.weight,
  weight: criterion.weight,
  sort_order: index,
}));

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;
type PublishedPrize = HackathonPrize & { finalScore: number; maxScore: number };

async function validateAdmin(adminCode: string) {
  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, slug, admin_code")
    .eq("admin_code", adminCode)
    .maybeSingle();

  if (!event) return { valid: false as const, error: "Not authorized" };
  return { valid: true as const, eventId: event.id as string, eventSlug: event.slug as string };
}

async function getCompetition(
  supabase: ServiceClient,
  competitionId: string,
  eventId?: string
) {
  let query = supabase
    .from("competitions")
    .select("id, event_id, title")
    .eq("id", competitionId);

  if (eventId) query = query.eq("event_id", eventId);

  const { data } = await query.maybeSingle();
  return data as { id: string; event_id: string; title: string } | null;
}

function revalidateJudgingPaths(adminCode: string, eventSlug: string) {
  revalidatePath(`/admin/${adminCode}/hackathon`);
  revalidatePath(`/admin/${adminCode}/competitions`);
  revalidatePath(`/${eventSlug}/hackathon`);
  revalidatePath(`/${eventSlug}/competitions`);
  revalidatePath(`/${eventSlug}`);
}

export async function ensureCompetitionJudgingCriteria(
  competitionId: string,
  adminCode: string
): Promise<{ success?: true; criteria?: CompetitionJudgingCriterion[]; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const competition = await getCompetition(supabase, competitionId, auth.eventId);
  if (!competition) return { error: "Competition not found" };

  const criteria = await ensureCriteriaRows(supabase, competition.id, competition.event_id);
  return { success: true, criteria };
}

async function ensureCriteriaRows(
  supabase: ServiceClient,
  competitionId: string,
  eventId: string
): Promise<CompetitionJudgingCriterion[]> {
  const { data: existing } = await supabase
    .from("competition_judging_criteria")
    .select("*")
    .eq("competition_id", competitionId)
    .order("sort_order", { ascending: true });

  if (existing?.length) return existing as CompetitionJudgingCriterion[];

  const { data, error } = await supabase
    .from("competition_judging_criteria")
    .insert(
      DEFAULT_JUDGING_CRITERIA.map((criterion) => ({
        ...criterion,
        event_id: eventId,
        competition_id: competitionId,
      }))
    )
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[ensureCriteriaRows] Error:", error);
    return [];
  }
  return (data ?? []) as CompetitionJudgingCriterion[];
}

export async function setCompetitionFinalists(
  competitionId: string,
  eventSlug: string,
  entryIds: string[],
  adminCode: string
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const uniqueEntryIds = [...new Set(entryIds)].filter(Boolean);
  const supabase = await createServiceClient();
  const competition = await getCompetition(supabase, competitionId, auth.eventId);
  if (!competition) return { error: "Competition not found" };

  if (uniqueEntryIds.length === 0) {
    await supabase
      .from("competition_finalist_entries")
      .delete()
      .eq("competition_id", competitionId);
    revalidateJudgingPaths(adminCode, eventSlug);
    return { success: true };
  }

  const { data: entries, error: entriesError } = await supabase
    .from("competition_entries")
    .select("id")
    .eq("competition_id", competitionId)
    .in("id", uniqueEntryIds);

  if (entriesError) return { error: entriesError.message };
  if ((entries ?? []).length !== uniqueEntryIds.length) {
    return { error: "One or more selected projects do not belong to this competition." };
  }

  const session = await getSession();
  await ensureCriteriaRows(supabase, competition.id, competition.event_id);

  const { error: deleteError } = await supabase
    .from("competition_finalist_entries")
    .delete()
    .eq("competition_id", competitionId);

  if (deleteError) return { error: deleteError.message };

  const { error } = await supabase.from("competition_finalist_entries").insert(
    uniqueEntryIds.map((entryId, index) => ({
      event_id: competition.event_id,
      competition_id: competitionId,
      entry_id: entryId,
      position: index,
      selected_by: session?.userId ?? null,
    }))
  );

  if (error) return { error: error.message };
  revalidateJudgingPaths(adminCode, eventSlug);
  return { success: true };
}

export async function saveCompetitionJudgingScorecard(
  competitionId: string,
  entryId: string,
  adminCode: string,
  scores: { criterionId: string; points: number }[],
  notes?: string | null
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const session = await getSession();
  if (!session?.userId) return { error: "Not authenticated" };

  const supabase = await createServiceClient();
  const competition = await getCompetition(supabase, competitionId, auth.eventId);
  if (!competition) return { error: "Competition not found" };

  const { data: finalist } = await supabase
    .from("competition_finalist_entries")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("entry_id", entryId)
    .maybeSingle();

  if (!finalist) return { error: "Only finalist projects can be scored." };

  const criteria = await ensureCriteriaRows(supabase, competition.id, competition.event_id);
  const criteriaById = new Map(criteria.map((criterion) => [criterion.id, criterion]));

  for (const score of scores) {
    const criterion = criteriaById.get(score.criterionId);
    if (!criterion) return { error: "Invalid scoring criterion." };
    if (score.points < 0 || score.points > Number(criterion.max_points)) {
      return { error: `${criterion.label} must be between 0 and ${criterion.max_points}.` };
    }
  }

  const now = new Date().toISOString();
  const { data: scorecard, error: scorecardError } = await supabase
    .from("competition_judging_scorecards")
    .upsert(
      {
        event_id: competition.event_id,
        competition_id: competitionId,
        entry_id: entryId,
        judge_id: session.userId,
        notes: notes?.trim() || null,
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: "competition_id,entry_id,judge_id" }
    )
    .select("id")
    .single();

  if (scorecardError || !scorecard) {
    return { error: scorecardError?.message ?? "Could not save scorecard." };
  }

  const scorecardId = scorecard.id as string;
  const { error: itemsError } = await supabase
    .from("competition_judging_score_items")
    .upsert(
      scores.map((score) => ({
        scorecard_id: scorecardId,
        criterion_id: score.criterionId,
        points: score.points,
        updated_at: now,
      })),
      { onConflict: "scorecard_id,criterion_id" }
    );

  if (itemsError) return { error: itemsError.message };
  revalidateJudgingPaths(adminCode, auth.eventSlug);
  return { success: true };
}

export async function calculateCompetitionJudgingStandings(
  competitionId: string
): Promise<CompetitionJudgingStanding[]> {
  const supabase = await createServiceClient();
  const competition = await getCompetition(supabase, competitionId);
  if (!competition) return [];

  const [criteriaResult, finalistsResult, scorecardsResult] = await Promise.all([
    supabase
      .from("competition_judging_criteria")
      .select("*")
      .eq("competition_id", competitionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("competition_finalist_entries")
      .select("*, entry:competition_entries!competition_finalist_entries_entry_id_fkey(*, user:users(id, name, email))")
      .eq("competition_id", competitionId)
      .order("position", { ascending: true }),
    supabase
      .from("competition_judging_scorecards")
      .select("*, items:competition_judging_score_items(*)")
      .eq("competition_id", competitionId),
  ]);

  const criteria = (criteriaResult.data ?? []) as CompetitionJudgingCriterion[];
  const maxScore = criteria.reduce((sum, criterion) => sum + Number(criterion.max_points), 0) || 100;
  const scorecards = scorecardsResult.data ?? [];

  const standings = (finalistsResult.data ?? []).map((finalist: any) => {
    const cards = scorecards.filter((card: any) => card.entry_id === finalist.entry_id);
    const total = cards.reduce((sum: number, card: any) => {
      const cardTotal = (card.items ?? []).reduce(
        (itemSum: number, item: any) => itemSum + Number(item.points ?? 0),
        0
      );
      return sum + cardTotal;
    }, 0);

    return {
      competition_id: competitionId,
      entry_id: finalist.entry_id,
      placement: 0,
      final_score: cards.length ? Math.round((total / cards.length) * 100) / 100 : 0,
      max_score: maxScore,
      judge_count: cards.length,
      entry: finalist.entry as CompetitionEntry,
    };
  });

  return standings
    .sort((a, b) => b.final_score - a.final_score || b.judge_count - a.judge_count)
    .map((standing, index) => ({ ...standing, placement: index + 1 }));
}

export async function publishCompetitionJudgingResults(
  competitionId: string,
  eventSlug: string,
  adminCode: string,
  placementCount = 3,
  prizes: HackathonPrize[] = []
): Promise<{ success?: true; standings?: CompetitionJudgingStanding[]; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const competition = await getCompetition(supabase, competitionId, auth.eventId);
  if (!competition) return { error: "Competition not found" };

  const standings = await calculateCompetitionJudgingStandings(competitionId);
  if (standings.length === 0) return { error: "Select finalists before publishing winners." };

  const winners = standings.slice(0, Math.max(1, placementCount));
  const unscoredWinners = winners.filter((standing) => standing.judge_count === 0);
  if (unscoredWinners.length > 0) {
    const projectList = unscoredWinners
      .map((standing) => standing.entry?.title ?? "Untitled project")
      .join(", ");
    return { error: `Cannot publish until every winner candidate has at least one judge scorecard. Missing scores: ${projectList}.` };
  }

  const now = new Date().toISOString();
  const prizeByPlacement = new Map(prizes.map((prize) => [Number(prize.placement), prize]));

  const { error: deleteError } = await supabase
    .from("competition_judging_results")
    .delete()
    .eq("competition_id", competitionId);

  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase.from("competition_judging_results").insert(
    winners.map((standing) => {
      const prize = prizeByPlacement.get(standing.placement);
      const prizeSnapshot: PublishedPrize | Record<string, never> = prize
        ? {
            ...prize,
            placement: standing.placement,
            finalScore: standing.final_score,
            maxScore: standing.max_score,
          }
        : {};

      return {
        event_id: competition.event_id,
        competition_id: competitionId,
        entry_id: standing.entry_id,
        placement: standing.placement,
        final_score: standing.final_score,
        max_score: standing.max_score,
        judge_count: standing.judge_count,
        prize: prizeSnapshot,
        is_published: true,
        published_at: now,
      };
    })
  );

  if (insertError) return { error: insertError.message };

  const winnerText = winners
    .map((winner) => `${winner.placement}. ${winner.entry.title}`)
    .join(" | ");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await supabase.from("announcements").insert({
    event_id: competition.event_id,
    content: `Hackathon winners announced for ${competition.title}: ${winnerText}`,
    priority: 10,
    published_at: now,
    expires_at: expiresAt,
  });

  revalidateJudgingPaths(adminCode, eventSlug);
  return { success: true, standings: winners };
}

export async function unpublishCompetitionJudgingResults(
  competitionId: string,
  eventSlug: string,
  adminCode: string
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const competition = await getCompetition(supabase, competitionId, auth.eventId);
  if (!competition) return { error: "Competition not found" };

  const { error } = await supabase
    .from("competition_judging_results")
    .update({ is_published: false })
    .eq("competition_id", competitionId)
    .eq("is_published", true);

  if (error) return { error: error.message };

  const now = new Date().toISOString();
  const { error: announcementError } = await supabase
    .from("announcements")
    .update({ expires_at: now })
    .eq("event_id", competition.event_id)
    .ilike("content", `Hackathon winners announced for ${competition.title}:%`);

  if (announcementError) return { error: announcementError.message };

  revalidateJudgingPaths(adminCode, eventSlug);
  return { success: true };
}

export async function resetCompetitionFinalRound(
  competitionId: string,
  eventSlug: string,
  adminCode: string
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const competition = await getCompetition(supabase, competitionId, auth.eventId);
  if (!competition) return { error: "Competition not found" };

  const { error: resultsError } = await supabase
    .from("competition_judging_results")
    .delete()
    .eq("competition_id", competitionId);

  if (resultsError) return { error: resultsError.message };

  const { error: scorecardsError } = await supabase
    .from("competition_judging_scorecards")
    .delete()
    .eq("competition_id", competitionId);

  if (scorecardsError) return { error: scorecardsError.message };

  const now = new Date().toISOString();
  const { error: announcementError } = await supabase
    .from("announcements")
    .update({ expires_at: now })
    .eq("event_id", competition.event_id)
    .ilike("content", `Hackathon winners announced for ${competition.title}:%`);

  if (announcementError) return { error: announcementError.message };

  revalidateJudgingPaths(adminCode, eventSlug);
  return { success: true };
}
