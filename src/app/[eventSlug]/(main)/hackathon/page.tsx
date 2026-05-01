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
} from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
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

  const [settings, myTeam, receivedInvites, allTeams, openPool, scores] = await Promise.all([
    getHackathonSettings(event.id),
    getMyHackathonTeam(event.id, session.userId),
    getMyReceivedHackathonInvites(event.id, session.userId),
    getHackathonTeamsWithMembers(event.id),
    getCheckedInAttendeesWithoutTeams(event.id, session.userId),
    getHackathonScores(event.id),
  ]);

  const sentInviteUserIds = myTeam
    ? await getMySentHackathonInviteUserIds(myTeam.id)
    : [];

  return (
    <HackathonClient
      event={event}
      userId={session.userId}
      settings={settings}
      myTeam={myTeam}
      receivedInvites={receivedInvites}
      sentInviteUserIds={sentInviteUserIds}
      allTeams={allTeams}
      openPool={openPool}
      scores={scores}
    />
  );
}
