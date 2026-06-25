import { notFound } from "next/navigation";
import {
  getEventBySlug,
  getHackathonSettings,
  getHackathonTeamsWithMembers,
  getHackathonScores,
} from "@/lib/supabase/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { HackathonLeaderboard } from "@/components/hackathon/HackathonLeaderboard";
import type { Pass6Result } from "@/lib/hackathon-analysis/types";

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

  let publicAIScores: { team_id: string; overall_score: number }[] = [];
  if (settings?.ai_scores_visible) {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("hackathon_ai_analyses")
      .select("team_id, result")
      .eq("event_id", event.id)
      .eq("pass_name", "pass6_synthesis")
      .eq("status", "complete");

    publicAIScores = ((data ?? []) as { team_id: string; result: Pass6Result | null }[])
      .flatMap((row) => {
        if (!row.result || typeof row.result.overall_score !== "number") return [];
        return [{ team_id: row.team_id, overall_score: row.result.overall_score }];
      });
  }

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
