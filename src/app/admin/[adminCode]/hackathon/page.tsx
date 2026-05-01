import { getEventForAdmin } from "@/lib/utils/admin";
import { getHackathonSettings, getHackathonTeamsWithMembers, getHackathonScores } from "@/lib/supabase/queries";
import { HackathonAdminClient } from "@/app/admin/_clients/[adminCode]/hackathon/HackathonAdminClient";

interface Props {
  params: Promise<{ adminCode: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HackathonAdminPage({ params }: Props) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);

  const [settings, teams, scores] = await Promise.all([
    getHackathonSettings(event.id),
    getHackathonTeamsWithMembers(event.id),
    getHackathonScores(event.id),
  ]);

  return (
    <HackathonAdminClient
      event={event}
      adminCode={adminCode}
      initialSettings={settings}
      initialTeams={teams}
      initialScores={scores}
    />
  );
}
