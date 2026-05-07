"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import type { HackathonChatChannel, HackathonChatMessage } from "@/types";
import { getHackathonChatMessages } from "@/lib/supabase/queries";

const DIRECT_CHANNEL_PREFIX = "dm:";

function getDirectChannelName(userIdA: string, userIdB: string) {
  return `${DIRECT_CHANNEL_PREFIX}${[userIdA, userIdB].sort().join(":")}`;
}

function getDirectChannelUserIds(name: string) {
  if (!name.startsWith(DIRECT_CHANNEL_PREFIX)) return [];
  return name.slice(DIRECT_CHANNEL_PREFIX.length).split(":").filter(Boolean);
}

// Auto-provision the three default channels for a hackathon event
export async function ensureDefaultChannels(eventId: string) {
  const supabase = await createServiceClient();

  const defaults = [
    { name: "general", channel_type: "general", position: 0 },
    { name: "announcements", channel_type: "announcements", position: 1 },
    { name: "resources", channel_type: "resources", position: 2 },
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

export async function ensureDirectChannel(
  eventId: string,
  targetUserId: string
): Promise<{ error?: string; channel?: HackathonChatChannel }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };
  if (session.userId === targetUserId) return { error: "You cannot DM yourself" };

  const supabase = await createServiceClient();

  const { data: targetRegistration } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!targetRegistration) return { error: "User is not registered for this event" };

  const name = getDirectChannelName(session.userId, targetUserId);
  const { data: existing } = await supabase
    .from("hackathon_chat_channels")
    .select("*")
    .eq("event_id", eventId)
    .eq("name", name)
    .maybeSingle();

  if (existing) return { channel: existing as HackathonChatChannel };

  const { data: channel, error } = await supabase
    .from("hackathon_chat_channels")
    .insert({
      event_id: eventId,
      name,
      channel_type: "dm",
      position: 1000,
    })
    .select("*")
    .single();

  if (error) {
    const { data: racedChannel } = await supabase
      .from("hackathon_chat_channels")
      .select("*")
      .eq("event_id", eventId)
      .eq("name", name)
      .maybeSingle();

    if (racedChannel) return { channel: racedChannel as HackathonChatChannel };
    return { error: error.message };
  }

  return { channel: channel as HackathonChatChannel };
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

  // Verify the user can access this channel
  const { data: channel } = await supabase
    .from("hackathon_chat_channels")
    .select("id, name, channel_type, team_id, event_id")
    .eq("id", channelId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!channel) return { error: "Channel not found" };

  if (channel.channel_type === "dm") {
    const participantIds = getDirectChannelUserIds(channel.name);
    if (!participantIds.includes(session.userId)) {
      return { error: "You are not a participant in this DM" };
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
      const { data: user } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.userId)
        .maybeSingle();

      const adminRoles = ["admin", "staff", "facilitator"];
      if (!user || !adminRoles.includes(user.role)) {
        return { error: "You are not a member of this team" };
      }
    }
  }

  // For announcements, only admins/staff can post
  if (channel.channel_type === "announcements") {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();

    const adminRoles = ["admin", "staff", "facilitator"];
    if (!user || !adminRoles.includes(user.role)) {
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

  return {
    message: {
      ...(msg as unknown as HackathonChatMessage),
      user: user ? { id: user.id, name: user.name } : undefined,
      reactions: [],
    },
  };
}

export async function deleteChatMessage(
  messageId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: msg } = await supabase
    .from("hackathon_chat_messages")
    .select("user_id, event_id")
    .eq("id", messageId)
    .maybeSingle();

  if (!msg) return { error: "Message not found" };

  // Allow delete if own message or admin
  if (msg.user_id !== session.userId) {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();

    const adminRoles = ["admin", "staff", "facilitator"];
    if (!user || !adminRoles.includes(user.role)) {
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

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .maybeSingle();

  const adminRoles = ["admin", "staff", "facilitator"];
  if (!user || !adminRoles.includes(user.role)) {
    return { error: "Only admins can pin messages" };
  }

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
  return getHackathonChatMessages(channelId, 40, beforeId);
}

export async function fetchChannelMessages(
  channelId: string
): Promise<HackathonChatMessage[]> {
  return getHackathonChatMessages(channelId, 60);
}
