"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { mapToHackathonScores } from "@/lib/hackathon-analysis/criteria";
import type { Pass6Result, HackathonAIAnalysis } from "@/lib/hackathon-analysis/types";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// Fetch all AI analysis passes for a set of teams
export async function getTeamAnalyses(
  eventId: string,
  teamIds: string[]
): Promise<Record<string, HackathonAIAnalysis[]>> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("hackathon_ai_analyses")
    .select("*")
    .eq("event_id", eventId)
    .in("team_id", teamIds)
    .order("pass_name");

  const grouped: Record<string, HackathonAIAnalysis[]> = {};
  for (const row of data ?? []) {
    if (!grouped[row.team_id]) grouped[row.team_id] = [];
    grouped[row.team_id].push(row as HackathonAIAnalysis);
  }
  return grouped;
}

// Trigger analysis via the API route (called from admin UI)
export async function triggerAnalysis(
  teamId: string,
  eventId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) return { error: "NEXT_PUBLIC_BASE_URL is not configured" };

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const res = await fetch(`${baseUrl}/api/hackathon/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ teamId, eventId }),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: (data as { error?: string }).error ?? "Analysis failed to start" };
  }
  return { success: true };
}

// Apply AI Pass 6 scores to hackathon_scores (admin funnel)
export async function applyAIScores(
  adminCode: string,
  teamId: string,
  eventId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  // Verify admin
  const { data: adminEvent } = await supabase
    .from("events")
    .select("id")
    .eq("admin_code", adminCode)
    .eq("id", eventId)
    .maybeSingle();
  if (!adminEvent) return { error: "Not authorized" };

  // Get Pass 6 result
  const { data: pass6Row } = await supabase
    .from("hackathon_ai_analyses")
    .select("result, status")
    .eq("team_id", teamId)
    .eq("pass_name", "pass6_synthesis")
    .eq("status", "complete")
    .maybeSingle();

  if (!pass6Row?.result) return { error: "Pass 6 synthesis not complete yet" };

  const pass6 = pass6Row.result as Pass6Result;
  const mapped = mapToHackathonScores(pass6.criteria_scores);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("hackathon_scores")
    .upsert(
      {
        team_id: teamId,
        event_id: eventId,
        judge_id: session.userId,
        innovation: mapped.innovation,
        execution: mapped.execution,
        presentation: mapped.presentation,
        ux_polish: mapped.ux_polish,
        notes: `AI Score (overall ${pass6.overall_score.toFixed(1)}/10): ${pass6.most_impressive_aspect}`,
        updated_at: now,
      },
      { onConflict: "team_id,judge_id" }
    );

  if (error) return { error: error.message };

  const { data: eventRow } = await supabase.from("events").select("slug").eq("id", eventId).single();
  if (eventRow?.slug) revalidatePath(`/admin/${adminCode}/hackathon`);

  return { success: true };
}

// Push top N AI-scored teams to Final Round as competition finalists
export async function pushTopAIToFinalRound(
  adminCode: string,
  eventId: string,
  competitionId: string,
  count = 8
): Promise<{ success?: true; error?: string; pushed?: number }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  // Verify admin
  const { data: adminEvent } = await supabase
    .from("events")
    .select("id, slug")
    .eq("admin_code", adminCode)
    .eq("id", eventId)
    .maybeSingle();
  if (!adminEvent) return { error: "Not authorized" };

  // Get all completed Pass 6 results for this event
  const { data: syntheses } = await supabase
    .from("hackathon_ai_analyses")
    .select("team_id, result")
    .eq("event_id", eventId)
    .eq("pass_name", "pass6_synthesis")
    .eq("status", "complete");

  if (!syntheses?.length) return { error: "No completed AI analyses found. Run AI screening first." };

  // Sort by overall_score descending, take top N
  const sorted = (syntheses as { team_id: string; result: Pass6Result }[])
    .map((row) => ({ teamId: row.team_id, score: (row.result as Pass6Result).overall_score ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);

  const topTeamIds = sorted.map((s) => s.teamId);

  // Fetch repo_urls for those teams
  const { data: projects } = await supabase
    .from("hackathon_projects")
    .select("team_id, repo_url")
    .in("team_id", topTeamIds)
    .not("repo_url", "is", null);

  const repoByTeam = new Map(
    (projects ?? []).map((p: { team_id: string; repo_url: string }) => [p.team_id, p.repo_url.trim().replace(/\/$/, "")])
  );

  // Match to competition entries by repo_url
  const { data: entries } = await supabase
    .from("competition_entries")
    .select("id, repo_url")
    .eq("competition_id", competitionId);

  const entryByRepo = new Map(
    (entries ?? []).map((e: { id: string; repo_url: string }) => [e.repo_url.trim().replace(/\/$/, ""), e.id])
  );

  // Build ordered list of entry IDs for the top teams
  const entryIds: string[] = [];
  for (const { teamId } of sorted) {
    const repo = repoByTeam.get(teamId);
    if (!repo) continue;
    const entryId = entryByRepo.get(repo);
    if (entryId && !entryIds.includes(entryId)) entryIds.push(entryId);
  }

  if (!entryIds.length) {
    return { error: "Could not match AI-scored teams to competition entries. Make sure repo URLs match between project submissions and competition entries." };
  }

  // Delegate to the existing finalist setter
  const { setCompetitionFinalists } = await import("@/lib/actions/competition-judging");
  const result = await setCompetitionFinalists(competitionId, adminEvent.slug, entryIds, adminCode);
  if (result.error) return { error: result.error };

  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true, pushed: entryIds.length };
}
