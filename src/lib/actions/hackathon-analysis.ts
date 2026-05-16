"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { mapToHackathonScores } from "@/lib/hackathon-analysis/criteria";
import type { Pass6Result, HackathonAIAnalysis } from "@/lib/hackathon-analysis/types";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

async function getBaseUrl(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;

  const protocol =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

function normalizeRepoUrl(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsed.pathname.replace(/\/$/, "").replace(/\.git$/i, "").toLowerCase();
    return `${hostname}${pathname}`;
  } catch {
    return trimmed.replace(/\/$/, "").replace(/\.git$/i, "").toLowerCase();
  }
}

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
  eventId: string,
  adminCode: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const baseUrl = await getBaseUrl();
  if (!baseUrl) return { error: "Could not determine application URL" };

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const res = await fetch(`${baseUrl}/api/hackathon/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ teamId, eventId, adminCode }),
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
        ...mapped,
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

  // Fetch submitted projects for those teams
  const { data: projects } = await supabase
    .from("hackathon_projects")
    .select("team_id, name, description, repo_url, demo_url, video_url")
    .in("team_id", topTeamIds)
    .not("submitted_at", "is", null)
    .not("repo_url", "is", null);

  const projectsByTeam = new Map(
    (projects ?? []).map((project: {
      team_id: string;
      name: string;
      description: string | null;
      repo_url: string;
      demo_url: string | null;
      video_url: string | null;
    }) => [project.team_id, project])
  );

  if (projectsByTeam.size === 0) {
    return { error: "No submitted projects with repo URLs were found for the AI-scored teams." };
  }

  const { data: members } = await supabase
    .from("hackathon_team_members")
    .select("team_id, user_id, role, joined_at")
    .in("team_id", topTeamIds)
    .order("joined_at", { ascending: true });

  const primaryUserByTeam = new Map<string, string>();
  for (const teamId of topTeamIds) {
    const teamMembers = (members ?? []).filter((member: {
      team_id: string;
      user_id: string;
      role: string | null;
    }) => member.team_id === teamId);
    const leader = teamMembers.find((member) => member.role === "leader");
    const primaryUserId = leader?.user_id ?? teamMembers[0]?.user_id;
    if (primaryUserId) primaryUserByTeam.set(teamId, primaryUserId);
  }

  // Match existing entries by project identity. Several seeded hackathon teams can share
  // the same organizer account, so user_id is not a safe finalist-entry key here.
  const { data: entries } = await supabase
    .from("competition_entries")
    .select("id, repo_url")
    .eq("competition_id", competitionId);

  const entryByRepo = new Map(
    (entries ?? [])
      .map((entry: { id: string; repo_url: string | null }) => [normalizeRepoUrl(entry.repo_url), entry.id] as const)
      .filter(([repo]) => repo)
  );

  // Build ordered list of entry IDs for the top teams
  const entryIds: string[] = [];
  for (const { teamId } of sorted) {
    const project = projectsByTeam.get(teamId);
    if (!project?.repo_url) continue;

    const primaryUserId = primaryUserByTeam.get(teamId);
    if (!primaryUserId) continue;

    const normalizedRepo = normalizeRepoUrl(project.repo_url);
    let entryId = entryByRepo.get(normalizedRepo);

    if (!entryId) {
      const { data: inserted, error: insertError } = await supabase
        .from("competition_entries")
        .insert({
          competition_id: competitionId,
          user_id: primaryUserId,
          title: project.name,
          description: project.description,
          repo_url: project.repo_url,
          project_url: project.demo_url,
          video_url: project.video_url,
        })
        .select("id")
        .single();

      if (insertError) return { error: insertError.message };
      entryId = inserted?.id;
    } else {
      await supabase
        .from("competition_entries")
        .update({
          title: project.name,
          description: project.description,
          repo_url: project.repo_url,
          project_url: project.demo_url,
          video_url: project.video_url,
        })
        .eq("id", entryId);
    }

    if (entryId && !entryIds.includes(entryId)) entryIds.push(entryId);
  }

  if (!entryIds.length) {
    return { error: "Could not create final-round entries from the AI-scored teams. Make sure the top teams have submitted projects and team members." };
  }

  // Delegate to the existing finalist setter
  const { setCompetitionFinalists } = await import("@/lib/actions/competition-judging");
  const result = await setCompetitionFinalists(competitionId, adminEvent.slug, entryIds, adminCode);
  if (result.error) return { error: result.error };

  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true, pushed: entryIds.length };
}
