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
import type { HackathonProfile } from "@/types";
import type { Pass6Result } from "@/lib/hackathon-analysis/types";

interface Props {
  params: Promise<{ eventSlug: string }>;
}

type PublicAIScore = {
  team_id: string;
  overall_score: number;
  criteria_scores: { criteria_key: string; score: number }[];
  updated_at: string;
};

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
    .select("checked_in_at")
    .eq("event_id", event.id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!registration?.checked_in_at) {
    redirect(`/${eventSlug}`);
  }

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

  const publicAIAnalyses = settings?.ai_scores_visible
    ? await supabase
        .from("hackathon_ai_analyses")
        .select("team_id, result, updated_at")
        .eq("event_id", event.id)
        .eq("pass_name", "pass6_synthesis")
        .eq("status", "complete")
    : { data: [] };

  // Admins need all shared channels so they can monitor unassigned attendees in Spawn Point.
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

  const initialScreenshots = (screenshotRows ?? []) as { id: string; file_url: string }[];
  const initialTeamAnalyses = (analysisRows ?? []) as { id: string; pass_name: string; status: string; updated_at: string }[];
  const publicAIScores: PublicAIScore[] = ((publicAIAnalyses.data ?? []) as {
    team_id: string;
    result: Pass6Result | null;
    updated_at: string;
  }[]).flatMap((row) => {
    const result = row.result;
    if (!result || typeof result.overall_score !== "number" || !Array.isArray(result.criteria_scores)) {
      return [];
    }

    return [{
      team_id: row.team_id,
      overall_score: result.overall_score,
      criteria_scores: result.criteria_scores
        .filter((criterion) => typeof criterion.criteria_key === "string" && typeof criterion.score === "number")
        .map((criterion) => ({
          criteria_key: criterion.criteria_key,
          score: criterion.score,
        })),
      updated_at: row.updated_at,
    }];
  });
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
      initialTeamAnalyses={initialTeamAnalyses}
      audienceVotePoll={audienceVotePoll as import("@/types").PollWithVotes | null}
    />
  );
}
