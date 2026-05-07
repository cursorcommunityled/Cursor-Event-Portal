"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import type { HackathonChatMessage } from "@/types";
import { getHackathonChatMessages } from "@/lib/supabase/queries";

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
    .select("id, channel_type, team_id, event_id")
    .eq("id", channelId)
    .eq("event_id", eventId)
    .single();

  if (!channel) return { error: "Channel not found" };

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
    .select("*, user:users!hackathon_chat_messages_user_id_fkey(id, name)")
    .single();

  if (error) return { error: error.message };
  return { message: msg as unknown as HackathonChatMessage };
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
