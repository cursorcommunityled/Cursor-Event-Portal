import type { HackathonAIAnalysis, Pass6Result } from "./types";

const PASS_ORDER = [
  "pass1_repo",
  "pass2_code",
  "pass3_innovation",
  "pass4_visual",
  "pass5_pool",
  "pass6_synthesis",
] as const;

const PASS_INDEX = new Map(PASS_ORDER.map((passName, index) => [passName, index]));

export function sortAnalyses(analyses: HackathonAIAnalysis[]) {
  return [...analyses].sort(
    (a, b) => (PASS_INDEX.get(a.pass_name) ?? 99) - (PASS_INDEX.get(b.pass_name) ?? 99)
  );
}

export function mergeTeamAnalyses(
  current: HackathonAIAnalysis[],
  incoming: HackathonAIAnalysis[]
) {
  const byPass = new Map(current.map((analysis) => [analysis.pass_name, analysis]));
  for (const analysis of incoming) {
    const existing = byPass.get(analysis.pass_name);
    if (
      !existing ||
      new Date(analysis.updated_at).getTime() >= new Date(existing.updated_at).getTime()
    ) {
      byPass.set(analysis.pass_name, analysis);
    }
  }
  return sortAnalyses([...byPass.values()]);
}

export function mergeAnalysisMaps(
  current: Record<string, HackathonAIAnalysis[]>,
  incoming: Record<string, HackathonAIAnalysis[]>
) {
  const next = { ...current };
  for (const [teamId, rows] of Object.entries(incoming)) {
    next[teamId] = mergeTeamAnalyses(current[teamId] ?? [], rows);
  }
  return next;
}

export function getCompletedPass6(analyses: HackathonAIAnalysis[]): Pass6Result | null {
  const pass6Row = analyses.find((analysis) => analysis.pass_name === "pass6_synthesis");
  if (!pass6Row?.result || pass6Row.status === "error") return null;

  const result = pass6Row.result as Pass6Result;
  if (typeof result.overall_score !== "number" || !Array.isArray(result.criteria_scores)) {
    return null;
  }

  return result;
}
