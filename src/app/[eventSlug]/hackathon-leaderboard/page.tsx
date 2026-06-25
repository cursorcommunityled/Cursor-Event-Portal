import { notFound } from "next/navigation";
import {
  getEventBySlug,
  getHackathonSettings,
  getHackathonTeamsWithMembers,
  getHackathonScores,
} from "@/lib/supabase/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { HackathonLeaderboard } from "@/components/hackathon/HackathonLeaderboard";
import type { AIScreeningScoreDetail } from "@/components/hackathon/AIScreeningScoreAssessment";
import type { Pass6Result } from "@/lib/hackathon-analysis/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ eventSlug: string }>;
}

export default async function HackathonLeaderboardPage({ params }: Props) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event || !event.is_hackathon) notFound();

  const [settings, teams, scores] = await Promise.all([
    getHackathonSettings(event.id),
    getHackathonTeamsWithMembers(event.id),
    getHackathonScores(event.id),
  ]);

  let publicAIScores: AIScreeningScoreDetail[] = [];
  if (settings?.ai_scores_visible) {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("hackathon_ai_analyses")
      .select("team_id, result, updated_at")
      .eq("event_id", event.id)
      .eq("pass_name", "pass6_synthesis")
      .eq("status", "complete")
      .order("updated_at", { ascending: false });

    const latestByTeam = new Map<string, AIScreeningScoreDetail>();
    for (const row of (data ?? []) as { team_id: string; result: Pass6Result | null }[]) {
      if (latestByTeam.has(row.team_id)) continue;

      const result = row.result;
      if (!result || typeof result.overall_score !== "number" || !Array.isArray(result.criteria_scores)) {
        continue;
      }

      latestByTeam.set(row.team_id, {
        team_id: row.team_id,
        overall_score: result.overall_score,
        criteria_scores: result.criteria_scores
          .filter((criterion) => typeof criterion.criteria_key === "string" && typeof criterion.score === "number")
          .map((criterion) => ({
            criteria_key: criterion.criteria_key,
            score: criterion.score,
            reasoning: criterion.reasoning,
            confidence: criterion.confidence,
          })),
        most_impressive_aspect: result.most_impressive_aspect,
        recommended_award_categories: result.recommended_award_categories,
        judge_briefing_points: result.judge_briefing_points,
        concerns_and_limitations: result.concerns_and_limitations,
      });
    }

    publicAIScores = [...latestByTeam.values()];
  }

  return (
    <HackathonLeaderboard
      event={event}
      initialSettings={settings}
      initialTeams={teams}
      initialScores={scores}
      initialPublicAIScores={publicAIScores}
    />
  );
}
