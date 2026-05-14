"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

interface UserProfile {
  id: string;
  name: string;
  role_category?: string | null;
  cursor_experience?: string | null;
  goals?: string[];
  offers?: string[];
  intent?: string | null;
}

interface SuggestionPair {
  recipient_id: string;
  suggested_user_id: string;
  message: string;
}

async function getUnassignedUsersWithProfiles(eventId: string): Promise<UserProfile[]> {
  const supabase = await createServiceClient();

  // Get all team member user_ids for this event
  const { data: eventTeams } = await supabase
    .from("hackathon_teams")
    .select("id")
    .eq("event_id", eventId);
  const teamIds = (eventTeams ?? []).map((t: { id: string }) => t.id);

  const teamUserIds = new Set<string>();
  if (teamIds.length) {
    const { data: members } = await supabase
      .from("hackathon_team_members")
      .select("user_id")
      .in("team_id", teamIds);
    for (const m of members ?? []) teamUserIds.add(m.user_id as string);
  }

  // Get checked-in registrations
  const { data: regs } = await supabase
    .from("registrations")
    .select("user_id")
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null);

  const unassignedIds = (regs ?? [])
    .map((r: { user_id: string }) => r.user_id)
    .filter((id: string) => !teamUserIds.has(id));

  if (!unassignedIds.length) return [];

  // Fetch user info + intake data
  const { data: users } = await supabase
    .from("users")
    .select("id, name, role_category, cursor_experience")
    .in("id", unassignedIds);

  const { data: intakes } = await supabase
    .from("attendee_intakes")
    .select("user_id, goals, offers, intent")
    .eq("event_id", eventId)
    .eq("skipped", false)
    .in("user_id", unassignedIds);

  const intakeMap = new Map(
    (intakes ?? []).map((i: { user_id: string; goals: string[]; offers: string[]; intent: string | null }) => [i.user_id, i])
  );

  return (users ?? []).map((u: { id: string; name: string; role_category?: string | null; cursor_experience?: string | null }) => {
    const intake = intakeMap.get(u.id);
    return {
      id: u.id,
      name: u.name,
      role_category: u.role_category ?? null,
      cursor_experience: u.cursor_experience ?? null,
      goals: (intake?.goals as string[] | undefined) ?? [],
      offers: (intake?.offers as string[] | undefined) ?? [],
      intent: (intake?.intent as string | null | undefined) ?? null,
    };
  });
}

function buildPrompt(users: UserProfile[]): string {
  const profileLines = users.map((u) => {
    const parts: string[] = [`ID: ${u.id}`, `Name: ${u.name}`];
    if (u.role_category) parts.push(`Role: ${u.role_category}`);
    if (u.cursor_experience && u.cursor_experience !== "none") parts.push(`Cursor: ${u.cursor_experience}`);
    if (u.goals?.length) parts.push(`Goals: ${u.goals.join(", ")}`);
    if (u.offers?.length) parts.push(`Offers: ${u.offers.join(", ")}`);
    if (u.intent) parts.push(`About: ${u.intent.slice(0, 150)}`);
    return parts.join(" | ");
  });

  return `You are a hackathon team matchmaker. Below are unassigned attendee profiles. For each person, suggest ONE other person they should invite to their team based on complementary skills and shared goals.

Return ONLY valid JSON — an array of objects with these exact keys:
- "recipient_id": the user who will receive the suggestion (string UUID)
- "suggested_user_id": the user they should invite (string UUID)
- "message": a single conversational sentence like "Alex is a designer looking to build products — they'd complement your technical background." (max 120 chars)

Rules:
- Each person should appear as recipient exactly once
- Pairs should be complementary (e.g. technical + business, builder + designer)
- Message should feel personal and helpful, not generic
- Do not suggest someone invites themselves
- Return only the JSON array, no other text

Profiles:
${profileLines.join("\n")}`;
}

export async function triggerTeamMatchSuggestions(
  eventId: string
): Promise<{ success?: true; count?: number; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  // Verify admin
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .maybeSingle();
  const adminRoles = ["admin", "staff", "facilitator"];
  if (!user || !adminRoles.includes(user.role as string)) return { error: "Admin only" };

  // Verify event belongs to admin's session
  if (session.eventId !== eventId) return { error: "Event mismatch" };

  const profiles = await getUnassignedUsersWithProfiles(eventId);
  if (profiles.length < 2) return { error: "Need at least 2 unassigned attendees to suggest matches" };

  // Call Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let pairs: SuggestionPair[] = [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(profiles) }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { error: "LLM returned unexpected format" };
    pairs = JSON.parse(jsonMatch[0]) as SuggestionPair[];
  } catch (e) {
    console.error("[triggerTeamMatchSuggestions] LLM error:", e);
    return { error: "Failed to generate suggestions" };
  }

  // For each pair, open a DM channel and drop in a suggestion card
  let sent = 0;
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  for (const pair of pairs) {
    if (!pair.recipient_id || !pair.suggested_user_id || !pair.message) continue;
    if (!profileMap.has(pair.recipient_id) || !profileMap.has(pair.suggested_user_id)) continue;

    const [aId, bId] = [pair.recipient_id, pair.suggested_user_id].sort();
    const channelName = `dm:${aId}:${bId}`;

    // Ensure DM channel exists — try upsert then fallback fetch
    let channelId: string | null = null;

    const { data: upserted, error: chanErr } = await supabase
      .from("hackathon_chat_channels")
      .upsert(
        { event_id: eventId, name: channelName, channel_type: "dm", position: 1000 },
        { onConflict: "event_id,name" }
      )
      .select("id")
      .single();

    if (!chanErr && upserted) {
      channelId = upserted.id;
    } else {
      const { data: existing } = await supabase
        .from("hackathon_chat_channels")
        .select("id")
        .eq("event_id", eventId)
        .eq("name", channelName)
        .maybeSingle();
      if (!existing) continue;
      channelId = existing.id;
    }

    if (!channelId) continue;

    const suggested = profileMap.get(pair.suggested_user_id);
    const fullMessage = `${suggested?.name ?? "Someone"} — ${pair.message} Invite them to your team?`;

    const { error: msgErr } = await supabase
      .from("hackathon_chat_messages")
      .insert({
        channel_id: channelId,
        event_id: eventId,
        user_id: session.userId, // admin is the sender; UI renders it as bot card
        content: fullMessage,
        is_system_message: true,
        suggestion_user_id: pair.suggested_user_id,
        mentioned_user_ids: [pair.suggested_user_id],
      });

    if (!msgErr) sent++;
  }

  return { success: true, count: sent };
}
