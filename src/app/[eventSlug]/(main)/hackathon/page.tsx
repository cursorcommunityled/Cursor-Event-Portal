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
} from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { ensureDefaultChannels } from "@/lib/actions/hackathon-chat";
import { createServiceClient } from "@/lib/supabase/server";
import { HackathonClient } from "@/components/hackathon/HackathonClient";

interface Props {
  params: Promise<{ eventSlug: string }>;
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
    .select("checked_in_at")
    .eq("event_id", event.id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!registration?.checked_in_at) {
    redirect(`/${eventSlug}`);
  }

  // Ensure default channels exist (idempotent)
  await ensureDefaultChannels(event.id);

  const [settings, myTeam, receivedInvites, allTeams, openPool, scores, chatMembers, judgingResults] =
    await Promise.all([
      getHackathonSettings(event.id),
      getMyHackathonTeam(event.id, session.userId),
      getMyReceivedHackathonInvites(event.id, session.userId),
      getHackathonTeamsWithMembers(event.id),
      getCheckedInAttendeesWithoutTeams(event.id, session.userId),
      getHackathonScores(event.id),
      getEventChatMembers(event.id),
      getPublishedCompetitionJudgingResults(event.id),
    ]);

  const sentInviteUserIds = myTeam
    ? await getMySentHackathonInviteUserIds(myTeam.id)
    : [];

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
  const [{ data: hackathonProfile }, { data: audienceVoteRow }] = await Promise.all([
    supabase
      .from("hackathon_profiles")
      .select("user_id, event_id, occupation, is_technical, unique_skill, linkedin_url, needs_team, accessibility, profile_bio, project_interests, collaboration_style, looking_for_teammates, created_at, updated_at")
      .eq("event_id", event.id)
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("polls")
      .select("*, votes:poll_votes(*)")
      .eq("event_id", event.id)
      .eq("hackathon_audience_vote", true)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  // Build audience vote poll with counts + user vote
  let audienceVotePoll = null;
  if (audienceVoteRow) {
    const allVotes = (audienceVoteRow.votes as { user_id: string; option_index: number }[]) ?? [];
    const userVote = allVotes.find((v) => v.user_id === session.userId) ?? null;
    const options = audienceVoteRow.options as string[];
    const voteCounts = options.map((_, i) => allVotes.filter((v) => v.option_index === i).length);
    audienceVotePoll = {
      ...audienceVoteRow,
      votes: allVotes,
      user_vote: userVote,
      vote_counts: voteCounts,
      total_votes: allVotes.length,
    };
  }

  // Chat: get channels visible to this user (general + their team channel)
  const chatChannels = await getHackathonChatChannels(event.id, myTeam?.id ?? null, session.userId);
  const defaultChannel = chatChannels[0] ?? null;
  const initialMessages = defaultChannel
    ? await getHackathonChatMessages(defaultChannel.id, 60)
    : [];

  // Determine if the current user is an admin (for chat posting permissions)
  const currentMember = chatMembers.find((m) => m.id === session.userId);
  const isAdmin =
    currentMember?.role === "admin" ||
    currentMember?.role === "staff" ||
    currentMember?.role === "facilitator";

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
      chatChannels={chatChannels}
      initialMessages={initialMessages}
      initialChannelId={defaultChannel?.id ?? ""}
      chatMembers={chatMembers}
      publishedJudgingResults={judgingResults}
      needsTeam={hackathonProfile?.needs_team === true}
      hackathonProfile={hackathonProfile as import("@/types").HackathonProfile | null}
      initialScreenshots={initialScreenshots}
      initialTeamAnalyses={initialTeamAnalyses}
      audienceVotePoll={audienceVotePoll as import("@/types").PollWithVotes | null}
    />
  );
}
