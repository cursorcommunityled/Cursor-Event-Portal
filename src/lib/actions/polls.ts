"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import { fanOutNotification } from "@/lib/notifications";

export type AudienceVoteWinnerPrompt = {
  pollId: string;
  optionIndex: number;
  option: string;
  voteCount: number;
  totalVotes: number;
  tiedOptions: string[];
  createdAt: string | null;
};

export type PublishedAudienceVoteAnnouncement = {
  title: string;
  voteCount: number;
  totalVotes: number;
  publishedAt: string | null;
};

type AudienceVotePollRow = {
  id: string;
  event_id: string;
  options: unknown;
  created_at: string | null;
  votes?: { option_index: number | null }[] | null;
};

const AUDIENCE_FAVOURITE_COMPETITION_TITLE = "Audience Favourite";

function getAdminPollsPath(eventSlug: string, adminCode?: string) {
  return adminCode ? `/admin/${eventSlug}/${adminCode}/polls` : `/admin/${eventSlug}/polls`;
}

function normalizeAudienceOption(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getAudienceVoteOptions(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map((option) => String(option)).filter(Boolean);
  }
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed.map((option) => String(option)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function calculateAudienceVoteWinner(poll: AudienceVotePollRow): AudienceVoteWinnerPrompt | null {
  const options = getAudienceVoteOptions(poll.options);
  if (options.length === 0) return null;

  const voteCounts = options.map(() => 0);
  for (const vote of poll.votes ?? []) {
    const optionIndex = Number(vote.option_index);
    if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < voteCounts.length) {
      voteCounts[optionIndex] += 1;
    }
  }

  const totalVotes = voteCounts.reduce((sum, count) => sum + count, 0);
  if (totalVotes === 0) return null;

  const voteCount = Math.max(...voteCounts);
  const winningIndexes = voteCounts
    .map((count, index) => ({ count, index }))
    .filter((item) => item.count === voteCount)
    .map((item) => item.index);
  const optionIndex = winningIndexes[0];

  return {
    pollId: poll.id,
    optionIndex,
    option: options[optionIndex],
    voteCount,
    totalVotes,
    tiedOptions: winningIndexes.map((index) => options[index]),
    createdAt: poll.created_at ?? null,
  };
}

async function audienceWinnerAlreadyApproved(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  pollCreatedAt: string | null
) {
  if (!pollCreatedAt) return false;

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("event_id", eventId)
    .eq("title", AUDIENCE_FAVOURITE_COMPETITION_TITLE)
    .maybeSingle();

  if (!competition?.id) return false;

  const { data: result } = await supabase
    .from("competition_judging_results")
    .select("id")
    .eq("event_id", eventId)
    .eq("competition_id", competition.id)
    .not("published_at", "is", null)
    .gte("published_at", pollCreatedAt)
    .limit(1)
    .maybeSingle();

  return Boolean(result);
}

export async function getPendingAudienceVoteWinner(
  eventId: string,
  adminCode: string
): Promise<AudienceVoteWinnerPrompt | null> {
  const supabase = await createServiceClient();

  const { data: adminEvent } = await supabase
    .from("events")
    .select("id")
    .eq("admin_code", adminCode)
    .eq("id", eventId)
    .maybeSingle();
  if (!adminEvent) return null;

  const { data: polls } = await supabase
    .from("polls")
    .select("id, event_id, options, created_at, votes:poll_votes(option_index)")
    .eq("event_id", eventId)
    .eq("hackathon_audience_vote", true)
    .eq("is_active", false)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const poll of (polls ?? []) as AudienceVotePollRow[]) {
    const winner = calculateAudienceVoteWinner(poll);
    if (!winner) continue;
    if (await audienceWinnerAlreadyApproved(supabase, eventId, poll.created_at)) continue;
    return winner;
  }

  return null;
}

export async function getPublishedAudienceVoteAnnouncement(
  eventId: string,
  adminCode: string
): Promise<PublishedAudienceVoteAnnouncement | null> {
  const supabase = await createServiceClient();

  const { data: adminEvent } = await supabase
    .from("events")
    .select("id")
    .eq("admin_code", adminCode)
    .eq("id", eventId)
    .maybeSingle();
  if (!adminEvent) return null;

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("event_id", eventId)
    .eq("title", AUDIENCE_FAVOURITE_COMPETITION_TITLE)
    .maybeSingle();

  if (!competition?.id) return null;

  const { data: result } = await supabase
    .from("competition_judging_results")
    .select("final_score, max_score, published_at, entry:competition_entries!competition_judging_results_entry_id_fkey(title)")
    .eq("event_id", eventId)
    .eq("competition_id", competition.id)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!result) return null;

  const entry = result.entry as { title?: string | null } | null;
  return {
    title: entry?.title ?? AUDIENCE_FAVOURITE_COMPETITION_TITLE,
    voteCount: Number(result.final_score ?? 0),
    totalVotes: Number(result.max_score ?? 0),
    publishedAt: result.published_at ?? null,
  };
}

async function validateAdminAccess(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  adminCode?: string
) {
  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .single();

    if (event && event.admin_code === adminCode) {
      return { valid: true as const };
    }

    return { valid: false as const, error: "Not authorized. Admin access required." };
  }

  const session = await getSession();
  if (!session) {
    return { valid: false as const, error: "Not authenticated" };
  }

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { valid: false as const, error: "Not authorized. Admin access required." };
  }

  return { valid: true as const, userId: session.userId };
}

export async function votePoll(
  pollId: string,
  optionIndex: number,
  eventSlug: string
) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Check if poll exists and is active
  const { data: poll } = await supabase
    .from("polls")
    .select("*")
    .eq("id", pollId)
    .single();

  if (!poll) {
    return { error: "Poll not found" };
  }

  if (!poll.is_active) {
    return { error: "Poll is no longer active" };
  }

  // Check if poll has ended
  if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
    return { error: "Poll has ended" };
  }

  // Check if user already voted
  const { data: existingVote } = await supabase
    .from("poll_votes")
    .select("id, option_index")
    .eq("poll_id", pollId)
    .eq("user_id", session.userId)
    .single();

  if (existingVote) {
    if (existingVote.option_index === optionIndex) {
      const { error } = await supabase
        .from("poll_votes")
        .delete()
        .eq("id", existingVote.id);

      if (error) {
        console.error("Failed to remove vote:", error);
        return { error: "Failed to remove vote" };
      }

      revalidatePath(`/${eventSlug}/polls`);
      return { success: true, removed: true };
    }

    // Update existing vote
    const { error } = await supabase
      .from("poll_votes")
      .update({ option_index: optionIndex })
      .eq("poll_id", pollId)
      .eq("user_id", session.userId);

    if (error) {
      console.error("Failed to update vote:", error);
      return { error: "Failed to update vote" };
    }
  } else {
    // Create new vote
    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      user_id: session.userId,
      option_index: optionIndex,
    });

    if (error) {
      console.error("Failed to create vote:", error);
      return { error: "Failed to submit vote" };
    }
  }

  revalidatePath(`/${eventSlug}/polls`);
  return { success: true };
}

export async function createPoll(
  eventId: string,
  eventSlug: string,
  data: {
    question: string;
    options: string[];
    ends_at?: string;
    is_active?: boolean;
  },
  adminCode?: string
) {
  try {
    const supabase = await createServiceClient();

    const auth = await validateAdminAccess(supabase, eventId, adminCode);
    if (!auth.valid) {
      return { error: auth.error || "Not authorized. Admin access required." };
    }

    const { data: poll, error } = await supabase
      .from("polls")
      .insert({
        event_id: eventId,
        question: data.question,
        options: data.options,
        ends_at: data.ends_at || null,
        is_active: data.is_active ?? false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("createPoll: Failed to create poll:", error);
      return { error: `Failed to create poll: ${error.message}` };
    }

    revalidatePath(getAdminPollsPath(eventSlug, adminCode));
    revalidatePath(`/${eventSlug}/polls`);
    return { success: true, pollId: poll.id };
  } catch (error) {
    console.error("createPoll: Exception:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("Missing") || errorMessage.includes("environment")) {
      return { error: "Server configuration error. Please contact support." };
    }
    return { error: `Failed to create poll: ${errorMessage}` };
  }
}

export async function updatePoll(
  pollId: string,
  eventSlug: string,
  data: {
    question?: string;
    options?: string[];
    ends_at?: string | null;
    is_active?: boolean;
    show_results?: boolean;
  },
  adminCode?: string
) {
  const supabase = await createServiceClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("event_id")
    .eq("id", pollId)
    .single();

  if (!poll) {
    return { error: "Poll not found" };
  }

  const auth = await validateAdminAccess(supabase, poll.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("polls")
    .update(data)
    .eq("id", pollId);

  if (error) {
    console.error("Failed to update poll:", error);
    return { error: "Failed to update poll" };
  }

  revalidatePath(getAdminPollsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/polls`);
  return { success: true };
}

export async function deletePoll(pollId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("event_id")
    .eq("id", pollId)
    .single();

  if (!poll) {
    return { error: "Poll not found" };
  }

  const auth = await validateAdminAccess(supabase, poll.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase.from("polls").delete().eq("id", pollId);

  if (error) {
    console.error("Failed to delete poll:", error);
    return { error: "Failed to delete poll" };
  }

  revalidatePath(getAdminPollsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/polls`);
  return { success: true };
}

export async function togglePollActive(pollId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("is_active, event_id")
    .eq("id", pollId)
    .single();

  if (!poll) {
    return { error: "Poll not found" };
  }

  const auth = await validateAdminAccess(supabase, poll.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("polls")
    .update({ is_active: !poll.is_active })
    .eq("id", pollId);

  if (error) {
    console.error("Failed to toggle poll:", error);
    return { error: "Failed to toggle poll" };
  }

  revalidatePath(getAdminPollsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/polls`);

  // Fan-out notification when poll goes live
  if (!poll.is_active) {
    const { data: pollData } = await supabase
      .from("polls")
      .select("question")
      .eq("id", pollId)
      .single();

    fanOutNotification(
      poll.event_id,
      "poll_opened",
      "New Poll Open",
      pollData?.question ?? "A new poll is now live — go vote!",
      `/${eventSlug}/polls`
    ).catch(() => {});
  }

  return { success: true, is_active: !poll.is_active };
}

/**
 * Automatically deactivate polls that have expired
 * This should be called when loading polls to ensure expired polls are marked as inactive
 */
export async function deactivateExpiredPolls(eventId: string, eventSlug?: string): Promise<number> {
  try {
    const supabase = await createServiceClient();
    const now = new Date().toISOString();

    // Find all active polls that have expired
    const { data: expiredPolls, error: fetchError } = await supabase
      .from("polls")
      .select("id")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .not("ends_at", "is", null)
      .lt("ends_at", now);

    if (fetchError) {
      console.error("[deactivateExpiredPolls] Error fetching expired polls:", fetchError);
      return 0;
    }

    if (!expiredPolls || expiredPolls.length === 0) {
      return 0;
    }

    // Deactivate all expired polls
    const pollIds = expiredPolls.map(p => p.id);
    const { error: updateError } = await supabase
      .from("polls")
      .update({ is_active: false })
      .in("id", pollIds);

    if (updateError) {
      console.error("[deactivateExpiredPolls] Error deactivating polls:", updateError);
      return 0;
    }

    console.log(`[deactivateExpiredPolls] Deactivated ${expiredPolls.length} expired poll(s)`);

    // Revalidate paths if eventSlug is provided
    if (eventSlug) {
      revalidatePath(getAdminPollsPath(eventSlug));
      revalidatePath(`/${eventSlug}/polls`);
    }

    return expiredPolls.length;
  } catch (error) {
    console.error("[deactivateExpiredPolls] Exception:", error);
    return 0;
  }
}

// ─── Hackathon audience vote ───────────────────────────────────────────────────

export async function createAudienceVotePoll(
  adminCode: string,
  eventId: string,
  eventSlug: string,
  manualTeamIds?: string[]
): Promise<{ success?: true; pollId?: string; error?: string }> {
  const supabase = await createServiceClient();

  const { data: adminEvent } = await supabase
    .from("events")
    .select("id")
    .eq("admin_code", adminCode)
    .eq("id", eventId)
    .maybeSingle();
  if (!adminEvent) return { error: "Not authorized" };

  // Deactivate any existing audience vote polls for this event
  await supabase
    .from("polls")
    .update({ is_active: false })
    .eq("event_id", eventId)
    .eq("hackathon_audience_vote", true);

  const selectedTeamIds = Array.from(new Set(manualTeamIds ?? []));
  if (selectedTeamIds.length > 8) return { error: "Select up to 8 teams for audience voting" };

  let options: string[] = [];

  if (selectedTeamIds.length > 0) {
    const [{ data: teams }, { data: projects }] = await Promise.all([
      supabase
        .from("hackathon_teams")
        .select("id, name")
        .eq("event_id", eventId)
        .in("id", selectedTeamIds),
      supabase
        .from("hackathon_projects")
        .select("team_id, name")
        .eq("event_id", eventId)
        .in("team_id", selectedTeamIds)
        .not("submitted_at", "is", null),
    ]);

    const teamMap = new Map((teams ?? []).map((team) => [team.id, team.name]));
    const projectMap = new Map((projects ?? []).map((project) => [project.team_id, project.name]));

    options = selectedTeamIds
      .map((teamId) => projectMap.get(teamId) || teamMap.get(teamId))
      .filter((option): option is string => Boolean(option));
  } else {
    const { data: projects } = await supabase
      .from("hackathon_projects")
      .select("name, team_id")
      .eq("event_id", eventId)
      .not("submitted_at", "is", null);

    if (projects?.length) {
      const teamIds = projects.map((project) => project.team_id).filter(Boolean);
      const { data: teams } = teamIds.length
        ? await supabase
            .from("hackathon_teams")
            .select("id, name")
            .eq("event_id", eventId)
            .in("id", teamIds)
        : { data: [] };
      const teamMap = new Map((teams ?? []).map((team) => [team.id, team.name]));

      options = projects
        .map((project) => project.name || teamMap.get(project.team_id) || "Unknown project")
        .filter(Boolean);
    }
  }

  if (!options.length) {
    return selectedTeamIds.length > 0
      ? { error: "None of the selected teams could be found" }
      : { error: "No submitted projects found — select teams manually or have teams submit first" };
  }

  const { data: poll, error } = await supabase
    .from("polls")
    .insert({
      event_id: eventId,
      question: "Vote for your favourite project!",
      options,
      is_active: true,
      show_results: true,
      hackathon_audience_vote: true,
    })
    .select("id")
    .single();

  if (error || !poll) return { error: error?.message ?? "Failed to create vote" };

  revalidatePath(`/${eventSlug}/hackathon`);
  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true, pollId: poll.id };
}

export async function closeAudienceVotePoll(
  adminCode: string,
  eventId: string,
  eventSlug: string
): Promise<{ success?: true; winner?: AudienceVoteWinnerPrompt | null; error?: string }> {
  const supabase = await createServiceClient();

  const { data: adminEvent } = await supabase
    .from("events")
    .select("id")
    .eq("admin_code", adminCode)
    .eq("id", eventId)
    .maybeSingle();
  if (!adminEvent) return { error: "Not authorized" };

  const { data: activePoll } = await supabase
    .from("polls")
    .select("id, event_id, options, created_at, votes:poll_votes(option_index)")
    .eq("event_id", eventId)
    .eq("hackathon_audience_vote", true)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("polls")
    .update({ is_active: false })
    .eq("event_id", eventId)
    .eq("hackathon_audience_vote", true);

  if (error) return { error: error.message };

  revalidatePath(`/${eventSlug}/hackathon`);
  revalidatePath(`/admin/${adminCode}/hackathon`);
  return {
    success: true,
    winner: activePoll ? calculateAudienceVoteWinner(activePoll as AudienceVotePollRow) : null,
  };
}

export async function hideAudienceVoteWinnerAnnouncement(
  adminCode: string,
  eventId: string,
  eventSlug: string
): Promise<{ success?: true; hidden?: boolean; error?: string }> {
  const supabase = await createServiceClient();

  const { data: adminEvent } = await supabase
    .from("events")
    .select("id")
    .eq("admin_code", adminCode)
    .eq("id", eventId)
    .maybeSingle();
  if (!adminEvent) return { error: "Not authorized" };

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("event_id", eventId)
    .eq("title", AUDIENCE_FAVOURITE_COMPETITION_TITLE)
    .maybeSingle();

  const now = new Date().toISOString();
  let hidden = false;

  if (competition?.id) {
    const { data: hiddenResults, error: updateError } = await supabase
      .from("competition_judging_results")
      .update({ is_published: false })
      .eq("event_id", eventId)
      .eq("competition_id", competition.id)
      .eq("is_published", true)
      .select("id");

    if (updateError) return { error: updateError.message };
    hidden = (hiddenResults?.length ?? 0) > 0;
  }

  const { error: announcementError } = await supabase
    .from("announcements")
    .update({ expires_at: now })
    .eq("event_id", eventId)
    .ilike("content", "Audience Favourite winner announced:%");

  if (announcementError) return { error: announcementError.message };

  revalidatePath(`/${eventSlug}/hackathon`);
  revalidatePath(`/${eventSlug}`);
  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true, hidden };
}

async function ensureAudienceFavouriteCompetition(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
) {
  const { data: existing } = await supabase
    .from("competitions")
    .select("id, title")
    .eq("event_id", eventId)
    .eq("title", AUDIENCE_FAVOURITE_COMPETITION_TITLE)
    .maybeSingle();

  if (existing?.id) return existing as { id: string; title: string };

  const { data, error } = await supabase
    .from("competitions")
    .insert({
      event_id: eventId,
      title: AUDIENCE_FAVOURITE_COMPETITION_TITLE,
      description: "Winner selected by the audience vote.",
      rules: "One vote per attendee. Admin approval publishes the final audience favourite.",
      status: "ended",
      voting_mode: "judges",
    })
    .select("id, title")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create audience favourite competition");
  return data as { id: string; title: string };
}

async function resolveAudienceWinnerProject(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  option: string
) {
  const normalizedOption = normalizeAudienceOption(option);
  const [{ data: projects }, { data: teams }] = await Promise.all([
    supabase
      .from("hackathon_projects")
      .select("id, team_id, name, description, repo_url, demo_url")
      .eq("event_id", eventId),
    supabase
      .from("hackathon_teams")
      .select("id, name")
      .eq("event_id", eventId),
  ]);

  const teamById = new Map((teams ?? []).map((team: { id: string; name: string }) => [team.id, team]));
  const project = (projects ?? []).find((candidate: { name: string; team_id: string }) => {
    const teamName = teamById.get(candidate.team_id)?.name ?? "";
    return normalizeAudienceOption(candidate.name) === normalizedOption
      || normalizeAudienceOption(teamName) === normalizedOption;
  }) as {
    team_id: string;
    name: string;
    description: string | null;
    repo_url: string | null;
    demo_url: string | null;
  } | undefined;

  const team = project
    ? teamById.get(project.team_id)
    : (teams ?? []).find((candidate: { name: string }) => (
        normalizeAudienceOption(candidate.name) === normalizedOption
      ));

  return { project, teamId: project?.team_id ?? team?.id ?? null };
}

async function getCompetitionEntryUserId(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  teamId: string | null
) {
  if (teamId) {
    const { data: member } = await supabase
      .from("hackathon_team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .order("role", { ascending: true })
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (member?.user_id) return member.user_id as string;
  }

  const session = await getSession();
  return session?.userId ?? null;
}

async function upsertAudienceWinnerEntry(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  competitionId: string,
  eventId: string,
  winner: AudienceVoteWinnerPrompt
) {
  const { project, teamId } = await resolveAudienceWinnerProject(supabase, eventId, winner.option);
  const userId = await getCompetitionEntryUserId(supabase, teamId);
  if (!userId) {
    throw new Error("Could not link the winning option to a team member. Add a team member or sign in as admin, then try again.");
  }

  const title = project?.name ?? winner.option;
  const repoUrl = project?.repo_url ?? project?.demo_url ?? "https://cursor.com";
  const projectUrl = project?.demo_url ?? project?.repo_url ?? null;
  const existingEntries = await supabase
    .from("competition_entries")
    .select("id, title, user_id")
    .eq("competition_id", competitionId);

  const normalizedTitle = normalizeAudienceOption(title);
  const existingEntry = (existingEntries.data ?? []).find((entry: { title: string; user_id: string }) => (
    normalizeAudienceOption(entry.title) === normalizedTitle || entry.user_id === userId
  )) as { id: string } | undefined;

  if (existingEntry?.id) {
    const { data, error } = await supabase
      .from("competition_entries")
      .update({
        user_id: userId,
        title,
        description: project?.description ?? null,
        repo_url: repoUrl,
        project_url: projectUrl,
      })
      .eq("id", existingEntry.id)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not update audience favourite entry");
    return data.id as string;
  }

  const { data, error } = await supabase
    .from("competition_entries")
    .insert({
      competition_id: competitionId,
      user_id: userId,
      title,
      description: project?.description ?? null,
      repo_url: repoUrl,
      project_url: projectUrl,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create audience favourite entry");
  return data.id as string;
}

export async function approveAudienceVoteWinner(
  adminCode: string,
  eventId: string,
  eventSlug: string,
  pollId: string
): Promise<{ success?: true; winner?: AudienceVoteWinnerPrompt; error?: string }> {
  const supabase = await createServiceClient();

  const { data: adminEvent } = await supabase
    .from("events")
    .select("id")
    .eq("admin_code", adminCode)
    .eq("id", eventId)
    .maybeSingle();
  if (!adminEvent) return { error: "Not authorized" };

  const { data: poll } = await supabase
    .from("polls")
    .select("id, event_id, options, created_at, votes:poll_votes(option_index)")
    .eq("id", pollId)
    .eq("event_id", eventId)
    .eq("hackathon_audience_vote", true)
    .maybeSingle();

  if (!poll) return { error: "Audience vote not found" };

  const winner = calculateAudienceVoteWinner(poll as AudienceVotePollRow);
  if (!winner) return { error: "No audience votes were cast, so there is no winner to approve." };
  if (winner.tiedOptions.length > 1) {
    return { error: `Audience vote is tied between ${winner.tiedOptions.join(", ")}. Break the tie before approving.` };
  }

  try {
    const competition = await ensureAudienceFavouriteCompetition(supabase, eventId);
    const entryId = await upsertAudienceWinnerEntry(supabase, competition.id, eventId, winner);
    const now = new Date().toISOString();

    const { error: deleteError } = await supabase
      .from("competition_judging_results")
      .delete()
      .eq("competition_id", competition.id);
    if (deleteError) return { error: deleteError.message };

    const { error: insertError } = await supabase
      .from("competition_judging_results")
      .insert({
        event_id: eventId,
        competition_id: competition.id,
        entry_id: entryId,
        placement: 1,
        final_score: winner.voteCount,
        max_score: Math.max(winner.totalVotes, 1),
        judge_count: winner.totalVotes,
        is_published: true,
        published_at: now,
      });
    if (insertError) return { error: insertError.message };

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from("announcements").insert({
      event_id: eventId,
      content: `Audience Favourite winner announced: ${winner.option} with ${winner.voteCount} of ${winner.totalVotes} votes.`,
      priority: 10,
      published_at: now,
      expires_at: expiresAt,
    });

    revalidatePath(`/${eventSlug}/hackathon`);
    revalidatePath(`/${eventSlug}`);
    revalidatePath(`/admin/${adminCode}/hackathon`);
    return { success: true, winner };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to approve audience favourite winner" };
  }
}
