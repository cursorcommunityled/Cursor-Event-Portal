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
  const { createServiceClient } = await import("@/lib/supabase/server");
  const _supa = await createServiceClient();

  const [{ data: screenshotRows }, { data: analysisRows }] = await Promise.all([
    myTeam
      ? _supa.from("hackathon_project_screenshots").select("id, file_url").eq("team_id", myTeam.id).order("sort_order")
      : Promise.resolve({ data: [] }),
    myTeam
      ? _supa.from("hackathon_ai_analyses").select("id, pass_name, status, updated_at").eq("team_id", myTeam.id)
      : Promise.resolve({ data: [] }),
  ]);

  const initialScreenshots = (screenshotRows ?? []) as { id: string; file_url: string }[];
  const initialTeamAnalyses = (analysisRows ?? []) as { id: string; pass_name: string; status: string; updated_at: string }[];
  const { data: hackathonProfile } = await _supa
    .from("hackathon_profiles")
    .select("needs_team")
    .eq("event_id", event.id)
    .eq("user_id", session.userId)
    .maybeSingle();

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
      initialScreenshots={initialScreenshots}
      initialTeamAnalyses={initialTeamAnalyses}
    />
  );
}
