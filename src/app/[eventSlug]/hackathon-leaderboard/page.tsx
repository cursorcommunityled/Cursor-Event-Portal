import { notFound } from "next/navigation";
import {
  getEventBySlug,
  getHackathonSettings,
  getHackathonTeamsWithMembers,
  getHackathonScores,
} from "@/lib/supabase/queries";
import { HackathonLeaderboard } from "@/components/hackathon/HackathonLeaderboard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ eventSlug: string }>;
}

export default async function HackathonLeaderboardPage({ params }: Props) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event || !event.is_hackathon) notFound();

  const [settings, teams, scores] = await Promise.all([
    getHackathonSettings(event.id),
    getHackathonTeamsWithMembers(event.id),
    getHackathonScores(event.id),
  ]);

  return (
    <HackathonLeaderboard
      event={event}
      initialSettings={settings}
      initialTeams={teams}
      initialScores={scores}
    />
  );
}
