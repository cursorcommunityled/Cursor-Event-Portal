"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import type { HackathonChatMessage } from "@/types";
import { getHackathonChatMessages } from "@/lib/supabase/queries";

type SupabaseServiceClient = Awaited<ReturnType<typeof createServiceClient>>;
type PortalSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
type ChatChannelRow = {
  id: string;
  name: string;
  channel_type: string;
  team_id: string | null;
  event_id: string;
};
type ChatMessagesResult = {
  messages: HackathonChatMessage[];
  error?: string;
};

const ADMIN_ROLES = new Set(["admin", "staff", "facilitator"]);

function isAdminRole(role: string | null | undefined) {
  return Boolean(role && ADMIN_ROLES.has(role));
}

function getDmParticipantIds(channelName: string) {
  const parts = channelName.split(":");
  return parts.length === 3 && parts[0] === "dm" ? [parts[1], parts[2]] : [];
}

async function isCheckedInForEvent(
  supabase: SupabaseServiceClient,
  eventId: string,
  userId: string
) {
  const { data } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .not("checked_in_at", "is", null)
    .maybeSingle();

  return Boolean(data);
}

async function getUserRole(supabase: SupabaseServiceClient, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return data?.role as string | null | undefined;
}

async function isTeamMember(
  supabase: SupabaseServiceClient,
  teamId: string,
  userId: string
) {
  const { data } = await supabase
    .from("hackathon_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .limit(1);

  return Boolean(data?.length);
}

async function userHasTeamInEvent(
  supabase: SupabaseServiceClient,
  eventId: string,
  userId: string
) {
  const { data: eventTeams } = await supabase
    .from("hackathon_teams")
    .select("id")
    .eq("event_id", eventId);
  const eventTeamIds = (eventTeams ?? []).map((team: { id: string }) => team.id);
  if (eventTeamIds.length === 0) return false;

  const { data: membership } = await supabase
    .from("hackathon_team_members")
    .select("id")
    .eq("user_id", userId)
    .in("team_id", eventTeamIds)
    .limit(1);

  return Boolean(membership?.length);
}

async function canAccessChannel(
  supabase: SupabaseServiceClient,
  channel: ChatChannelRow,
  session: PortalSession
) {
  if (session.eventId !== channel.event_id) return false;

  const [checkedIn, role] = await Promise.all([
    isCheckedInForEvent(supabase, channel.event_id, session.userId),
    getUserRole(supabase, session.userId),
  ]);

  if (!checkedIn) return false;
  if (isAdminRole(role)) return true;

  if (channel.channel_type === "dm") {
    return getDmParticipantIds(channel.name).includes(session.userId);
  }

  if (channel.team_id) {
    return isTeamMember(supabase, channel.team_id, session.userId);
  }

  if (channel.channel_type === "spawn_point") {
    return !(await userHasTeamInEvent(supabase, channel.event_id, session.userId));
  }

  return ["general", "announcements", "resources", "help"].includes(channel.channel_type);
}

async function getAuthorizedChannel(
  supabase: SupabaseServiceClient,
  channelId: string,
  session: PortalSession
) {
  const { data: channel } = await supabase
    .from("hackathon_chat_channels")
    .select("id, name, channel_type, team_id, event_id")
    .eq("id", channelId)
    .maybeSingle();

  if (!channel) return null;
  return (await canAccessChannel(supabase, channel, session)) ? channel : null;
}

// Auto-provision the three default channels for a hackathon event
export async function getOrCreateDMChannel(eventId: string, otherUserId: string) {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };
  if (session.userId === otherUserId) return { error: "Cannot create a DM with yourself" };

  const supabase = await createServiceClient();

  const otherUserCheckedIn = await isCheckedInForEvent(supabase, eventId, otherUserId);
  if (!otherUserCheckedIn) return { error: "User is not checked in for this event" };

  const [aId, bId] = [session.userId, otherUserId].sort();
  const channelName = `dm:${aId}:${bId}`;

  // Try to find existing
  const { data: existing } = await supabase
    .from("hackathon_chat_channels")
    .select("id")
    .eq("event_id", eventId)
    .eq("name", channelName)
    .maybeSingle();

  if (existing) return { channelId: existing.id };

  // Create new
  const { data: newChannel, error } = await supabase
    .from("hackathon_chat_channels")
    .insert({
      event_id: eventId,
      name: channelName,
      channel_type: "dm",
      position: 1000,
    })
    .select("id")
    .single();

  if (error || !newChannel) return { error: "Failed to create DM channel" };
  return { channelId: newChannel.id };
}

export async function ensureDefaultChannels(eventId: string) {
  const supabase = await createServiceClient();

  const defaults = [
    { name: "spawn-point", channel_type: "spawn_point", position: 0 },
    { name: "general", channel_type: "general", position: 1 },
    { name: "announcements", channel_type: "announcements", position: 2 },
    { name: "resources", channel_type: "resources", position: 3 },
    { name: "help", channel_type: "help", position: 4 },
  ];

  // Check which channels already exist first
  const { data: existing, error: fetchErr } = await supabase
    .from("hackathon_chat_channels")
    .select("name")
    .eq("event_id", eventId);

  if (fetchErr) {
    console.error("[ensureDefaultChannels] Failed to fetch existing channels:", fetchErr);
    return;
  }

  const existingNames = new Set((existing ?? []).map((c: { name: string }) => c.name));

  for (const ch of defaults) {
    if (existingNames.has(ch.name)) continue;
    const { error } = await supabase
      .from("hackathon_chat_channels")
      .insert({ event_id: eventId, ...ch });
    if (error) {
      console.error(`[ensureDefaultChannels] Failed to insert #${ch.name}:`, error);
    }
  }
}

// Create a team-specific private channel when a team is formed
export async function ensureTeamChannel(eventId: string, teamId: string, teamName: string) {
  const supabase = await createServiceClient();
  const channelName = `team-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  const { data: existing } = await supabase
    .from("hackathon_chat_channels")
    .select("id")
    .eq("event_id", eventId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data } = await supabase
    .from("hackathon_chat_channels")
    .insert({
      event_id: eventId,
      team_id: teamId,
      name: channelName,
      channel_type: "team",
      position: 10,
    })
    .select("id")
    .single();

  return data?.id ?? null;
}

export async function sendChatMessage(
  channelId: string,
  eventId: string,
  content: string | null,
  mentionedUserIds: string[] = [],
  fileUrl?: string | null,
  fileType?: "image" | "file" | null,
  fileName?: string | null,
  fileSizeBytes?: number | null
): Promise<{ error?: string; message?: HackathonChatMessage }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };

  if (!content?.trim() && !fileUrl) return { error: "Message cannot be empty" };

  const supabase = await createServiceClient();

  const currentUserCheckedIn = await isCheckedInForEvent(supabase, eventId, session.userId);
  if (!currentUserCheckedIn) return { error: "You must be checked in before using chat" };

  // Verify the user can access this channel
  const { data: channel } = await supabase
    .from("hackathon_chat_channels")
    .select("id, name, channel_type, team_id, event_id")
    .eq("id", channelId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!channel) return { error: "Channel not found" };

  if (channel.channel_type === "dm") {
    // Check if the user is part of the DM
    if (!getDmParticipantIds(channel.name).includes(session.userId)) {
      const role = await getUserRole(supabase, session.userId);
      if (!isAdminRole(role)) {
        return { error: "You cannot post in this DM" };
      }
    }
  }

  // For team channels, verify membership
  if (channel.team_id) {
    const { data: membership } = await supabase
      .from("hackathon_team_members")
      .select("id")
      .eq("team_id", channel.team_id)
      .eq("user_id", session.userId)
      .limit(1);

    if (!membership?.length) {
      // Admins can still post — check user role
      const role = await getUserRole(supabase, session.userId);
      if (!isAdminRole(role)) {
        return { error: "You are not a member of this team" };
      }
    }
  }

  // Spawn Point is only for members who haven't been assigned to a team yet
  if (channel.channel_type === "spawn_point") {
    const { data: eventTeams } = await supabase
      .from("hackathon_teams")
      .select("id")
      .eq("event_id", eventId);
    const eventTeamIds = (eventTeams ?? []).map((t: { id: string }) => t.id);
    if (eventTeamIds.length > 0) {
      const { data: userMembership } = await supabase
        .from("hackathon_team_members")
        .select("id")
        .eq("user_id", session.userId)
        .in("team_id", eventTeamIds)
        .limit(1);
      if (userMembership?.length) {
        const role = await getUserRole(supabase, session.userId);
        if (!isAdminRole(role)) {
          return { error: "You're on a team — use your team channel or #general" };
        }
      }
    }
  }

  // For announcements, only admins/staff can post
  if (channel.channel_type === "announcements") {
    const role = await getUserRole(supabase, session.userId);
    if (!isAdminRole(role)) {
      return { error: "Only admins can post in announcements" };
    }
  }

  const { data: msg, error } = await supabase
    .from("hackathon_chat_messages")
    .insert({
      channel_id: channelId,
      event_id: eventId,
      user_id: session.userId,
      content: content?.trim() || null,
      file_url: fileUrl ?? null,
      file_type: fileType ?? null,
      file_name: fileName ?? null,
      file_size_bytes: fileSizeBytes ?? null,
      mentioned_user_ids: mentionedUserIds,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[sendChatMessage] insert failed:", error);
    return { error: error.message };
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, name")
    .eq("id", session.userId)
    .maybeSingle();

  const mentionRecipientIds = [...new Set(mentionedUserIds)].filter((id) => id !== session.userId);
  if (mentionRecipientIds.length > 0) {
    const { data: eventRow } = await supabase
      .from("events")
      .select("slug")
      .eq("id", eventId)
      .maybeSingle();

    const senderName = user?.name ?? "Someone";
    const preview = content?.trim()
      ? content.trim().slice(0, 140)
      : fileName
        ? `Shared ${fileName}`
        : "Mentioned you in chat";

    await supabase.from("in_app_notifications").insert(
      mentionRecipientIds.map((recipientId) => ({
        user_id: recipientId,
        event_id: eventId,
        type: "chat_mention",
        title: `${senderName} mentioned you`,
        body: preview,
        action_url: eventRow?.slug ? `/${eventRow.slug}/hackathon` : null,
      }))
    );
  }

  return {
    message: {
      ...(msg as unknown as HackathonChatMessage),
      user: user ? { id: user.id, name: user.name } : undefined,
      reactions: [],
    },
  };
}

export async function editChatMessage(
  messageId: string,
  newContent: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  if (!newContent.trim()) return { error: "Message cannot be empty" };

  const supabase = await createServiceClient();

  const { data: msg } = await supabase
    .from("hackathon_chat_messages")
    .select("user_id, channel_id, event_id")
    .eq("id", messageId)
    .maybeSingle();

  if (!msg) return { error: "Message not found" };
  if (msg.event_id !== session.eventId) return { error: "Not authorised" };
  const channel = await getAuthorizedChannel(supabase, msg.channel_id, session);
  if (!channel) return { error: "Not authorised" };

  if (msg.user_id !== session.userId) {
    return { error: "You can only edit your own messages" };
  }

  const { error } = await supabase
    .from("hackathon_chat_messages")
    .update({ 
      content: newContent.trim(),
      updated_at: new Date().toISOString()
    })
    .eq("id", messageId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteChatMessage(
  messageId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: msg } = await supabase
    .from("hackathon_chat_messages")
    .select("user_id, channel_id, event_id")
    .eq("id", messageId)
    .maybeSingle();

  if (!msg) return { error: "Message not found" };
  if (msg.event_id !== session.eventId) return { error: "Not authorised" };
  const channel = await getAuthorizedChannel(supabase, msg.channel_id, session);
  if (!channel) return { error: "Not authorised" };

  // Allow delete if own message or admin
  if (msg.user_id !== session.userId) {
    const role = await getUserRole(supabase, session.userId);
    if (!isAdminRole(role)) {
      return { error: "Not authorised" };
    }
  }

  const { error } = await supabase
    .from("hackathon_chat_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) return { error: error.message };
  return {};
}

export async function pinChatMessage(
  messageId: string,
  pinned: boolean
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const role = await getUserRole(supabase, session.userId);
  if (!isAdminRole(role)) {
    return { error: "Only admins can pin messages" };
  }

  const { data: msg } = await supabase
    .from("hackathon_chat_messages")
    .select("channel_id, event_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg || msg.event_id !== session.eventId) return { error: "Message not found" };

  const channel = await getAuthorizedChannel(supabase, msg.channel_id, session);
  if (!channel) return { error: "Not authorised" };

  const { error } = await supabase
    .from("hackathon_chat_messages")
    .update({ is_pinned: pinned })
    .eq("id", messageId);

  if (error) return { error: error.message };
  return {};
}

export async function toggleChatReaction(
  messageId: string,
  emoji: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: msg } = await supabase
    .from("hackathon_chat_messages")
    .select("channel_id, event_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg || msg.event_id !== session.eventId) return { error: "Message not found" };

  const channel = await getAuthorizedChannel(supabase, msg.channel_id, session);
  if (!channel) return { error: "Not authorised" };

  const { data: existing } = await supabase
    .from("hackathon_chat_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", session.userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("hackathon_chat_reactions")
      .delete()
      .eq("id", existing.id);
  } else {
    await supabase
      .from("hackathon_chat_reactions")
      .insert({ message_id: messageId, user_id: session.userId, emoji });
  }

  return {};
}

export async function markChannelRead(
  channelId: string
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const supabase = await createServiceClient();
  const channel = await getAuthorizedChannel(supabase, channelId, session);
  if (!channel) return;

  await supabase
    .from("hackathon_chat_reads")
    .upsert(
      { user_id: session.userId, channel_id: channelId, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,channel_id" }
    );
}

export async function loadMoreMessages(
  channelId: string,
  beforeId: string
): Promise<HackathonChatMessage[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = await createServiceClient();
  const channel = await getAuthorizedChannel(supabase, channelId, session);
  if (!channel) return [];

  return getHackathonChatMessages(channelId, 40, beforeId);
}

export async function fetchChannelMessages(
  channelId: string
): Promise<ChatMessagesResult> {
  const session = await getSession();
  if (!session) return { messages: [], error: "Not authenticated" };

  const supabase = await createServiceClient();
  const channel = await getAuthorizedChannel(supabase, channelId, session);
  if (!channel) return { messages: [], error: "Not authorised" };

  return { messages: await getHackathonChatMessages(channelId, 60) };
}

export async function fetchPinnedMessages(
  channelId: string
): Promise<HackathonChatMessage[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = await createServiceClient();
  const channel = await getAuthorizedChannel(supabase, channelId, session);
  if (!channel) return [];

  return getHackathonChatMessages(channelId, 25, undefined, true);
}
