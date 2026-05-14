"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { mapToHackathonScores } from "@/lib/hackathon-analysis/criteria";
import type { Pass6Result, HackathonAIAnalysis } from "@/lib/hackathon-analysis/types";
import { revalidatePath } from "next/cache";

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

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/hackathon/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "" },
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
