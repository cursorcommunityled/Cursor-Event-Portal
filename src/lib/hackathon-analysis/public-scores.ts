import { createServiceClient } from "@/lib/supabase/server";
import type { AIScreeningScoreDetail } from "@/components/hackathon/AIScreeningScoreAssessment";
import type { Pass1Result, Pass6Result } from "./types";

export type PublicAIScreeningScore = AIScreeningScoreDetail & { updated_at: string };

type AnalysisRow = {
  team_id: string;
  result: Pass6Result | Pass1Result | null;
  updated_at: string;
};

function latestPass1SummariesByTeam(rows: AnalysisRow[]): Map<string, string> {
  const summaries = new Map<string, string>();
  for (const row of rows) {
    if (summaries.has(row.team_id)) continue;

    const result = row.result as Pass1Result | null;
    const summary = result?.readme_summary?.trim();
    if (summary) {
      summaries.set(row.team_id, summary);
    }
  }
  return summaries;
}

export async function getPublicAIScreeningScores(eventId: string): Promise<PublicAIScreeningScore[]> {
  const supabase = await createServiceClient();

  const [{ data: pass6Rows }, { data: pass1Rows }] = await Promise.all([
    supabase
      .from("hackathon_ai_analyses")
      .select("team_id, result, updated_at")
      .eq("event_id", eventId)
      .eq("pass_name", "pass6_synthesis")
      .eq("status", "complete")
      .order("updated_at", { ascending: false }),
    supabase
      .from("hackathon_ai_analyses")
      .select("team_id, result, updated_at")
      .eq("event_id", eventId)
      .eq("pass_name", "pass1_repo")
      .eq("status", "complete")
      .order("updated_at", { ascending: false }),
  ]);

  const projectSummaryByTeam = latestPass1SummariesByTeam((pass1Rows ?? []) as AnalysisRow[]);
  const latestByTeam = new Map<string, PublicAIScreeningScore>();

  for (const row of (pass6Rows ?? []) as AnalysisRow[]) {
    if (latestByTeam.has(row.team_id)) continue;

    const result = row.result as Pass6Result | null;
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
      project_summary: projectSummaryByTeam.get(row.team_id),
      most_impressive_aspect: result.most_impressive_aspect,
      recommended_award_categories: result.recommended_award_categories,
      judge_briefing_points: result.judge_briefing_points,
      concerns_and_limitations: result.concerns_and_limitations,
      updated_at: row.updated_at,
    });
  }

  return [...latestByTeam.values()];
}
