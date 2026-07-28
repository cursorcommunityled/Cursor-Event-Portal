import { notFound, redirect } from "next/navigation";
import {
  getEventBySlug,
  getHackathonSettings,
  getMyHackathonTeam,
  getMyReceivedHackathonInvites,
  getMySentHackathonInviteUserIds,
  getHackathonTeamsWithMembers,
  getCheckedInAttendeesWithoutTeams,
  getHackathonScores,
  getHackathonChatChannels,
  getHackathonChatMessages,
  getEventChatMembers,
  getPublishedCompetitionJudgingResults,
  getHackathonMentors,
  getHackathonJudges,
} from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { ensureDefaultChannels } from "@/lib/actions/hackathon-chat";
import { createServiceClient } from "@/lib/supabase/server";
import { HackathonClient } from "@/components/hackathon/HackathonClient";
import { withDefaultHackathonLinkedIn } from "@/lib/hackathon-profile-defaults";
import { getDemoSlotsWithCounts } from "@/lib/demo/service";
import { getPublicAIScreeningScores, type PublicAIScreeningScore } from "@/lib/hackathon-analysis/public-scores";
import type { HackathonProfile } from "@/types";

interface Props {
  params: Promise<{ eventSlug: string }>;
}

function enrichPublicScoresWithProjectDescriptions(
  scores: PublicAIScreeningScore[],
  teams: Awaited<ReturnType<typeof getHackathonTeamsWithMembers>>
): PublicAIScreeningScore[] {
  const descriptionByTeamId = new Map(
    teams.map((team) => [team.id, team.project?.description?.trim() || ""])
  );

  return scores.map((score) => ({
    ...score,
    project_summary:
      score.project_summary ||
      descriptionByTeamId.get(score.team_id) ||
      undefined,
  }));
}

export default async function HackathonPage({ params }: Props) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();
  if (!event.is_hackathon) notFound();

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const supabase = await createServiceClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("id, checked_in_at")
    .eq("event_id", event.id)
    .eq("user_id", session.userId)
    .maybeSingle();

  // Session + registration is enough for teams/chat ahead of doors.
  // checked_in_at (Luma/staff) unlocks the challenge prompt.
  if (!registration) {
    redirect(`/${eventSlug}`);
  }
  const isCheckedIn = !!registration.checked_in_at;

  // Ensure default channels exist (idempotent)
  await ensureDefaultChannels(event.id);

  const [settings, myTeam, receivedInvites, allTeams, openPool, scores, chatMembers, judgingResults, mentors, judges, mentorSlots, myMentorSignup] =
    await Promise.all([
      getHackathonSettings(event.id),
      getMyHackathonTeam(event.id, session.userId),
      getMyReceivedHackathonInvites(event.id, session.userId),
      getHackathonTeamsWithMembers(event.id),
      getCheckedInAttendeesWithoutTeams(event.id, session.userId),
      getHackathonScores(event.id),
      getEventChatMembers(event.id),
      getPublishedCompetitionJudgingResults(event.id),
      getHackathonMentors(event.id),
      getHackathonJudges(event.id),
      getDemoSlotsWithCounts(event.id),
      supabase
        .from("demo_slot_signups")
        .select("slot_id")
        .eq("event_id", event.id)
        .eq("user_id", session.userId)
        .maybeSingle(),
    ]);

  const publicAIScores: PublicAIScreeningScore[] = settings?.ai_scores_visible
    ? enrichPublicScoresWithProjectDescriptions(
        await getPublicAIScreeningScores(event.id),
        allTeams
      )
    : [];
  const currentMember = chatMembers.find((m) => m.id === session.userId);
  const isAdmin =
    currentMember?.role === "admin" ||
    currentMember?.role === "staff" ||
    currentMember?.role === "facilitator";

  const sentInviteUserIds = await getMySentHackathonInviteUserIds(event.id, session.userId);

  // Load team's existing screenshots + AI analysis status (status only, no scores)
  const [{ data: screenshotRows }, { data: analysisRows }] = await Promise.all([
    myTeam
      ? supabase.from("hackathon_project_screenshots").select("id, file_url").eq("team_id", myTeam.id).order("sort_order")
      : Promise.resolve({ data: [] }),
    myTeam
      ? supabase.from("hackathon_ai_analyses").select("id, pass_name, status, updated_at").eq("team_id", myTeam.id)
      : Promise.resolve({ data: [] }),
  ]);

  // First screenshot per team (lowest sort_order) so every project shows a preview
  // on its team card / AI screening card. One row each, keyed by team.
  const { data: allScreenshotRows } = await supabase
    .from("hackathon_project_screenshots")
    .select("team_id, file_url, sort_order")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true });

  const teamScreenshots: Record<string, string> = {};
  for (const row of (allScreenshotRows ?? []) as { team_id: string; file_url: string }[]) {
    if (!teamScreenshots[row.team_id]) teamScreenshots[row.team_id] = row.file_url;
  }

  const initialScreenshots = (screenshotRows ?? []) as { id: string; file_url: string }[];
  const initialTeamAnalyses = (analysisRows ?? []) as { id: string; pass_name: string; status: string; updated_at: string }[];
  const attendeeJudgingResults = settings?.audience_favorite_results_visible
    ? judgingResults
    : judgingResults.filter((result) => {
        const title = result.competition?.title?.trim().toLowerCase() ?? "";
        return title !== "audience favourite" && title !== "audience favorite";
      });

  const [{ data: hackathonProfile }, { data: intakeProfile }, { data: userProfile }, { data: audienceVoteRow }] = await Promise.all([
    supabase
      .from("hackathon_profiles")
      .select("user_id, event_id, occupation, is_technical, unique_skill, linkedin_url, needs_team, accessibility, profile_bio, project_interests, collaboration_style, looking_for_teammates, created_at, updated_at")
      .eq("event_id", event.id)
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("attendee_intakes")
      .select("linkedin")
      .eq("event_id", event.id)
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("linkedin")
      .eq("id", session.userId)
      .maybeSingle(),
    supabase
      .from("polls")
      .select("*, votes:poll_votes(*)")
      .eq("event_id", event.id)
      .eq("hackathon_audience_vote", true)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  const profileWithDefaults = withDefaultHackathonLinkedIn(
    hackathonProfile as HackathonProfile | null,
    intakeProfile?.linkedin ?? userProfile?.linkedin ?? null,
    session.userId,
    event.id
  );

  // Build audience vote poll with counts + user vote
  let audienceVotePoll = null;
  if (audienceVoteRow) {
    const allVotes = (audienceVoteRow.votes as { user_id: string; option_index: number }[]) ?? [];
    const userVote = allVotes.find((v) => v.user_id === session.userId) ?? null;
    const options = audienceVoteRow.options as string[];
    const voteCounts = options.map((_, i) => allVotes.filter((v) => v.option_index === i).length);
    const audienceResultsVisible = settings?.audience_favorite_results_visible ?? false;
    audienceVotePoll = {
      ...audienceVoteRow,
      show_results: audienceResultsVisible,
      votes: audienceResultsVisible ? allVotes : userVote ? [userVote] : [],
      user_vote: userVote,
      vote_counts: audienceResultsVisible ? voteCounts : options.map(() => 0),
      total_votes: audienceResultsVisible ? allVotes.length : 0,
    };
  }

  // Chat: admins see admin-wide channels; attendees see Spawn Point until they join a team.
  const chatChannels = await getHackathonChatChannels(
    event.id,
    isAdmin ? undefined : myTeam?.id ?? null,
    session.userId
  );
  const defaultChannel = chatChannels[0] ?? null;
  const initialMessages = defaultChannel
    ? await getHackathonChatMessages(defaultChannel.id, 60)
    : [];

  return (
    <HackathonClient
      event={event}
      userId={session.userId}
      isAdmin={isAdmin}
      isCheckedIn={isCheckedIn}
      settings={settings}
      myTeam={myTeam}
      receivedInvites={receivedInvites}
      sentInviteUserIds={sentInviteUserIds}
      allTeams={allTeams}
      openPool={openPool}
      scores={scores}
      publicAIScores={publicAIScores}
      chatChannels={chatChannels}
      initialMessages={initialMessages}
      initialChannelId={defaultChannel?.id ?? ""}
      chatMembers={chatMembers}
      publishedJudgingResults={attendeeJudgingResults}
      needsTeam={profileWithDefaults?.needs_team === true}
      hackathonProfile={profileWithDefaults}
      mentors={mentors}
      judges={judges}
      mentorSlots={mentorSlots.map((slot) => ({
        id: slot.id,
        mentor_id: slot.mentor_id,
        is_full: slot.is_full,
      }))}
      myMentorSlotId={myMentorSignup.data?.slot_id ?? null}
      initialScreenshots={initialScreenshots}
      teamScreenshots={teamScreenshots}
      initialTeamAnalyses={initialTeamAnalyses}
      audienceVotePoll={audienceVotePoll as import("@/types").PollWithVotes | null}
    />
  );
}
