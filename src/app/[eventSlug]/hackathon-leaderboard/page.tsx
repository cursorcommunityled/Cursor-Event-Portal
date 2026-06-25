import { notFound } from "next/navigation";
import {
  getEventBySlug,
  getHackathonSettings,
  getHackathonTeamsWithMembers,
  getHackathonScores,
} from "@/lib/supabase/queries";
import { HackathonLeaderboard } from "@/components/hackathon/HackathonLeaderboard";
import { getPublicAIScreeningScores } from "@/lib/hackathon-analysis/public-scores";

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

  const descriptionByTeamId = new Map(
    teams.map((team) => [team.id, team.project?.description?.trim() || ""])
  );

  const publicAIScores = settings?.ai_scores_visible
    ? (await getPublicAIScreeningScores(event.id)).map((score) => ({
        ...score,
        project_summary:
          score.project_summary ||
          descriptionByTeamId.get(score.team_id) ||
          undefined,
      }))
    : [];

  return (
    <HackathonLeaderboard
      event={event}
      initialSettings={settings}
      initialTeams={teams}
      initialScores={scores}
      initialPublicAIScores={publicAIScores}
    />
  );
}
