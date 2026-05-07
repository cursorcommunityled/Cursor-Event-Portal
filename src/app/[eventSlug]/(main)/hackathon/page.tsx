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
} from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
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

  const intakeStatus = await getIntakeStatus(event.id, session.userId);
  if (!intakeStatus.completed && !intakeStatus.skipped) {
    redirect(`/${eventSlug}/intake`);
  }

  // Ensure default channels exist (idempotent)
  await ensureDefaultChannels(event.id);

  const [settings, myTeam, receivedInvites, allTeams, openPool, scores, chatMembers] =
    await Promise.all([
      getHackathonSettings(event.id),
      getMyHackathonTeam(event.id, session.userId),
      getMyReceivedHackathonInvites(event.id, session.userId),
      getHackathonTeamsWithMembers(event.id),
      getCheckedInAttendeesWithoutTeams(event.id, session.userId),
      getHackathonScores(event.id),
      getEventChatMembers(event.id),
    ]);

  const sentInviteUserIds = myTeam
    ? await getMySentHackathonInviteUserIds(myTeam.id)
    : [];

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
    />
  );
}
