import { redirect } from "next/navigation";
import { getEventForAdmin } from "@/lib/utils/admin";
import {
  getHackathonSettings, getHackathonTeamsWithMembers, getHackathonScores,
  getHackathonChatChannels, getHackathonChatMessages, getEventChatMembers,
  getCompetitionJudgingData, getCheckedInAttendeesWithoutTeams,
  getHackathonRepoSubmissionBackups, getMentors,
} from "@/lib/supabase/queries";
import { ensureDefaultChannels } from "@/lib/actions/hackathon-chat";
import { getSession } from "@/lib/actions/registration";
import { getTeamAnalyses } from "@/lib/actions/hackathon-analysis";
import { createServiceClient } from "@/lib/supabase/server";
import { getPendingAudienceVoteWinner, getPublishedAudienceVoteAnnouncement } from "@/lib/actions/polls";
import { HackathonAdminClient } from "@/app/admin/_clients/[adminCode]/hackathon/HackathonAdminClient";
import { getDemoSlotsWithCounts } from "@/lib/demo/service";

interface Props {
  params: Promise<{ adminCode: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_TABS = ["settings", "teams", "scoring", "leaderboard", "judging", "chat", "people"] as const;
type Tab = typeof VALID_TABS[number];

export default async function HackathonAdminPage({ params, searchParams }: Props) {
  const { adminCode } = await params;
  const { tab } = await searchParams;
  if (tab === "submissions") {
    redirect(`/admin/${adminCode}/hackathon?tab=scoring`);
  }

  const activeTab: Tab = VALID_TABS.includes(tab as Tab) ? (tab as Tab) : "settings";
  const event = await getEventForAdmin(adminCode);

  await ensureDefaultChannels(event.id);

  const session = await getSession();

  const [settings, teams, scores, chatChannels, chatMembers, judgingCompetitions, openPool, repoSubmissionBackups, people, slots] = await Promise.all([
    getHackathonSettings(event.id),
    getHackathonTeamsWithMembers(event.id),
    getHackathonScores(event.id),
    // Admins see shared/admin channels plus their own DMs.
    getHackathonChatChannels(event.id, undefined, session?.userId ?? null),
    getEventChatMembers(event.id),
    getCompetitionJudgingData(event.id),
    // All checked-in attendees not yet on a team (no user to exclude)
    getCheckedInAttendeesWithoutTeams(event.id, ""),
    getHackathonRepoSubmissionBackups(event.id),
    getMentors(event.id),
    getDemoSlotsWithCounts(event.id),
  ]);

  const teamIds = teams.map((t) => t.id);
  const aiAnalyses = teamIds.length > 0 ? await getTeamAnalyses(event.id, teamIds) : {};

  const defaultChannel = chatChannels[0] ?? null;
  const initialMessages = defaultChannel
    ? await getHackathonChatMessages(defaultChannel.id, 60)
    : [];

  const supabase = await createServiceClient();
  const [{ data: activeAudienceVoteRow }, pendingAudienceVoteWinner, publishedAudienceWinner] = await Promise.all([
    supabase
      .from("polls")
      .select("id, options, is_active, votes:poll_votes(id)")
      .eq("event_id", event.id)
      .eq("hackathon_audience_vote", true)
      .eq("is_active", true)
      .maybeSingle(),
    getPendingAudienceVoteWinner(event.id, adminCode),
    getPublishedAudienceVoteAnnouncement(event.id, adminCode),
  ]);
  const activeAudienceVote = activeAudienceVoteRow as {
    id: string;
    options: string[] | null;
    is_active: boolean;
    votes?: { id: string }[] | null;
  } | null;

  return (
    <HackathonAdminClient
      event={event}
      adminCode={adminCode}
      activeTab={activeTab}
      initialSettings={settings}
      initialTeams={teams}
      initialScores={scores}
      chatChannels={chatChannels}
      initialMessages={initialMessages}
      initialChannelId={defaultChannel?.id ?? ""}
      chatMembers={chatMembers}
      adminUserId={session?.userId ?? null}
      judgingCompetitions={judgingCompetitions}
      initialAiAnalyses={aiAnalyses}
      initialOpenPool={openPool}
      initialRepoSubmissionBackups={repoSubmissionBackups}
      initialPeople={people}
      initialSlots={slots}
      initialAudienceVoteWinner={pendingAudienceVoteWinner}
      initialPublishedAudienceWinner={publishedAudienceWinner}
      initialAudienceVote={activeAudienceVote ? {
        id: activeAudienceVote.id,
        options: activeAudienceVote.options ?? [],
        totalVotes: activeAudienceVote.votes?.length ?? 0,
      } : null}
    />
  );
}
