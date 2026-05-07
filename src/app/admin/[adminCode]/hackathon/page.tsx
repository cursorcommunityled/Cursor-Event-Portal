import { getEventForAdmin } from "@/lib/utils/admin";
import {
  getHackathonSettings, getHackathonTeamsWithMembers, getHackathonScores,
  getHackathonChatChannels, getHackathonChatMessages, getEventChatMembers,
} from "@/lib/supabase/queries";
import { ensureDefaultChannels } from "@/lib/actions/hackathon-chat";
import { getSession } from "@/lib/actions/registration";
import { HackathonAdminClient } from "@/app/admin/_clients/[adminCode]/hackathon/HackathonAdminClient";

interface Props {
  params: Promise<{ adminCode: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HackathonAdminPage({ params }: Props) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);

  await ensureDefaultChannels(event.id);

  const session = await getSession();

  const [settings, teams, scores, chatChannels, chatMembers] = await Promise.all([
    getHackathonSettings(event.id),
    getHackathonTeamsWithMembers(event.id),
    getHackathonScores(event.id),
    // Admins see ALL channels (no teamId filter)
    getHackathonChatChannels(event.id, undefined, session?.userId ?? null),
    getEventChatMembers(event.id),
  ]);

  const defaultChannel = chatChannels[0] ?? null;
  const initialMessages = defaultChannel
    ? await getHackathonChatMessages(defaultChannel.id, 60)
    : [];

  return (
    <HackathonAdminClient
      event={event}
      adminCode={adminCode}
      initialSettings={settings}
      initialTeams={teams}
      initialScores={scores}
      chatChannels={chatChannels}
      initialMessages={initialMessages}
      initialChannelId={defaultChannel?.id ?? ""}
      chatMembers={chatMembers}
      adminUserId={session?.userId ?? null}
    />
  );
}
