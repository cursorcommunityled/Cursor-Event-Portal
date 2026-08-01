"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import { requireEventAdmin } from "@/lib/auth/admin-action";
import { mapToHackathonScores } from "@/lib/hackathon-analysis/criteria";
import {
  ensureGithubAccess,
  ensureGithubBudget,
} from "@/lib/hackathon-analysis/github/repo-fetcher";
import {
  cancelJob,
  enqueueAiJob,
  resolveRepoUrl,
  sweepStaleAiJobs,
} from "@/lib/hackathon-analysis/jobs";
import { processAiJobQueue } from "@/lib/hackathon-analysis/job-worker";
import type { Pass6Result, HackathonAIAnalysis, HackathonAIJob } from "@/lib/hackathon-analysis/types";
import { revalidatePath } from "next/cache";

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

/** Trigger / retry analysis — enqueues a durable job and kicks the worker. */
export async function triggerAnalysis(
  teamId: string,
  eventId: string,
  adminCode: string,
  opts?: { force?: boolean }
): Promise<{ success?: true; error?: string; skipped?: string }> {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) return authError;

  try {
    await ensureGithubAccess();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  await sweepStaleAiJobs(eventId);

  const supabase = await createServiceClient();
  const repoUrl = await resolveRepoUrl(supabase, eventId, teamId);
  if (!repoUrl) {
    return { error: "Team has no repo URL (checked project + submission backup)" };
  }

  const { data: project } = await supabase
    .from("hackathon_projects")
    .select("submitted_at")
    .eq("team_id", teamId)
    .maybeSingle();
  if (!project?.submitted_at) {
    return { error: "Team has not submitted a project" };
  }

  try {
    const { skipped } = await enqueueAiJob({
      eventId,
      teamId,
      repoUrl,
      force: opts?.force ?? false,
      clearFailedPasses: !(opts?.force ?? false),
    });
    void processAiJobQueue(eventId);
    return { success: true, skipped };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Clear analyses + cancel job so a team can start fresh. */
export async function resetAnalysis(
  teamId: string,
  eventId: string,
  adminCode: string
): Promise<{ success?: true; error?: string }> {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) return authError;

  const supabase = await createServiceClient();
  await cancelJob(teamId, eventId);
  const { error } = await supabase
    .from("hackathon_ai_analyses")
    .delete()
    .eq("team_id", teamId)
    .eq("event_id", eventId);

  if (error) return { error: error.message };
  return { success: true };
}

/** Enqueue all submitted teams, then process with concurrency cap of 3. */
export async function triggerAnalysisForAllSubmitted(
  eventId: string,
  adminCode: string
): Promise<{
  success?: true;
  error?: string;
  started?: number;
  skipped?: number;
  skippedNoRepo?: number;
  healed?: number;
  stillMissingRepo?: number;
  failed?: number;
  failures?: string[];
}> {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) return authError;

  try {
    await ensureGithubAccess();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  await sweepStaleAiJobs(eventId);

  // Promote backup-only / failed-primary rows before eligibility scan.
  const { autoHealSubmissionsFromBackups } = await import("@/lib/actions/hackathon");
  const heal = await autoHealSubmissionsFromBackups(eventId);

  const supabase = await createServiceClient();

  const { data: projects } = await supabase
    .from("hackathon_projects")
    .select("team_id, repo_url, submitted_at")
    .eq("event_id", eventId)
    .not("submitted_at", "is", null);

  const submitted = projects ?? [];
  const candidates: { team_id: string; repo_url: string }[] = [];
  let skippedNoRepo = 0;

  for (const project of submitted) {
    const repo =
      project.repo_url?.trim() ||
      (await resolveRepoUrl(supabase, eventId, project.team_id));
    if (!repo) {
      skippedNoRepo++;
      continue;
    }
    candidates.push({ team_id: project.team_id, repo_url: repo });
  }

  if (candidates.length === 0) {
    const healNote =
      heal.healed > 0 ? ` Healed ${heal.healed} from backup.` : "";
    return {
      error: skippedNoRepo > 0
        ? `${skippedNoRepo} team(s) submitted without a repo URL. Add repo URLs before running AI analysis.${healNote}`
        : `No submitted projects found.${healNote}`,
      healed: heal.healed,
      stillMissingRepo: heal.stillMissingRepo,
      skippedNoRepo,
    };
  }

  // Budget check against teams that are not already complete.
  const teamIds = candidates.map((c) => c.team_id);
  const { data: analyses } = await supabase
    .from("hackathon_ai_analyses")
    .select("team_id, pass_name, status")
    .eq("event_id", eventId)
    .in("team_id", teamIds);

  const pass6Complete = new Set(
    (analyses ?? [])
      .filter((a) => a.pass_name === "pass6_synthesis" && a.status === "complete")
      .map((a) => a.team_id)
  );

  const toEnqueue = candidates.filter((c) => !pass6Complete.has(c.team_id));

  try {
    await ensureGithubBudget(Math.max(toEnqueue.length, 1));
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  let started = 0;
  let skipped = pass6Complete.size;
  const failures: string[] = [];

  for (const project of toEnqueue) {
    try {
      const { skipped: skipReason } = await enqueueAiJob({
        eventId,
        teamId: project.team_id,
        repoUrl: project.repo_url,
        clearFailedPasses: true,
      });
      if (skipReason === "already_running" || skipReason === "already_queued") {
        skipped++;
      } else if (skipReason === "already_complete") {
        skipped++;
      } else {
        started++;
      }
    } catch (e) {
      failures.push(
        `${project.team_id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  void processAiJobQueue(eventId);

  if (started === 0 && failures.length > 0 && skipped === 0) {
    return { error: failures[0], failed: failures.length, failures };
  }

  if (started === 0 && failures.length === 0) {
    return {
      error:
        skipped > 0
          ? "All submitted projects are already analyzed, queued, or in progress."
          : "No projects to analyze.",
      skipped,
      skippedNoRepo,
      healed: heal.healed,
      stillMissingRepo: heal.stillMissingRepo,
    };
  }

  return {
    success: true,
    started,
    skipped,
    skippedNoRepo,
    healed: heal.healed,
    stillMissingRepo: heal.stillMissingRepo,
    failed: failures.length,
    failures: failures.length ? failures : undefined,
  };
}

export async function getAiJobsForEvent(
  eventId: string,
  adminCode: string
): Promise<{ jobs?: HackathonAIJob[]; error?: string }> {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) return authError;
  const { listAiJobs } = await import("@/lib/hackathon-analysis/jobs");
  const jobs = await listAiJobs(eventId);
  return { jobs };
}

// Apply AI Pass 6 scores to hackathon_scores (admin funnel)
export async function applyAIScores(
  adminCode: string,
  teamId: string,
  eventId: string
): Promise<{ success?: true; error?: string }> {
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) return authError;

  const supabase = await createServiceClient();

  // Resolve a judge identity for the AI score. Prefer the logged-in admin's
  // user; fall back to a stable admin user when operating via admin code only.
  const session = await getSession();
  let judgeId = session?.userId ?? null;
  if (!judgeId) {
    const { data: adminUser } = await supabase
      .from("users")
      .select("id")
      .eq("role", "admin")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    judgeId = adminUser?.id ?? null;
  }
  if (!judgeId) return { error: "No admin user available to attribute the AI score" };

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
        judge_id: judgeId,
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
  const authError = await requireEventAdmin(eventId, adminCode);
  if (authError) return authError;

  const supabase = await createServiceClient();

  // Confirm the event exists / fetch slug for revalidation (auth already done above).
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
