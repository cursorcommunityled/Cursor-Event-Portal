"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import type { HackathonSettings, HackathonTeamWithMembers, HackathonTeamInvite, HackathonScore } from "@/types";
import { ensureTeamChannel } from "./hackathon-chat";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function validateAdmin(adminCode: string) {
  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, slug")
    .eq("admin_code", adminCode)
    .maybeSingle();
  if (!event) return { valid: false as const, error: "Not authorized" };
  return { valid: true as const, eventId: event.id, eventSlug: event.slug };
}

function isFormationOpen(settings: HackathonSettings | null): boolean {
  if (!settings) return true; // no settings row = open by default
  if (!settings.team_formation_enabled) return false; // manual kill switch takes priority
  const now = new Date();
  if (settings.team_formation_opens_at && new Date(settings.team_formation_opens_at) > now) return false;
  if (settings.team_formation_closes_at && new Date(settings.team_formation_closes_at) < now) return false;
  return true;
}

// ─── Admin: toggle hackathon mode ─────────────────────────────────────────────

export async function toggleHackathonMode(
  adminCode: string,
  isHackathon: boolean
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ is_hackathon: isHackathon })
    .eq("id", auth.eventId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true };
}

// ─── Admin: save hackathon settings ───────────────────────────────────────────

export async function saveHackathonSettings(
  adminCode: string,
  data: {
    team_formation_enabled?: boolean;
    team_formation_opens_at?: string | null;
    team_formation_closes_at?: string | null;
    submission_deadline?: string | null;
    judging_starts_at?: string | null;
    min_team_size?: number;
    max_team_size?: number;
    prompt_text?: string;
  }
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const payload = {
    event_id: auth.eventId,
    ...data,
    updated_at: new Date().toISOString(),
  };

  const { data: existingSettings } = await supabase
    .from("hackathon_settings")
    .select("id")
    .eq("event_id", auth.eventId)
    .limit(1);

  const { error } = existingSettings?.[0]
    ? await supabase
        .from("hackathon_settings")
        .update(payload)
        .eq("id", existingSettings[0].id)
    : await supabase
        .from("hackathon_settings")
        .insert(payload);

  if (error) return { error: error.message };

  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true };
}

// ─── Admin: toggle team formation open/closed ─────────────────────────────────

export async function toggleTeamFormation(
  adminCode: string,
  enabled: boolean
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const payload = {
    event_id: auth.eventId,
    team_formation_enabled: enabled,
    updated_at: new Date().toISOString(),
  };

  const { data: existingSettings } = await supabase
    .from("hackathon_settings")
    .select("id")
    .eq("event_id", auth.eventId)
    .limit(1);

  const { error } = existingSettings?.[0]
    ? await supabase
        .from("hackathon_settings")
        .update(payload)
        .eq("id", existingSettings[0].id)
    : await supabase
        .from("hackathon_settings")
        .insert(payload);

  if (error) return { error: error.message };

  if (enabled) {
    await supabase
      .from("hackathon_teams")
      .update({ locked_at: null, updated_at: new Date().toISOString() })
      .eq("event_id", auth.eventId);
  }

  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true };
}

// ─── Admin: toggle leaderboard visibility ─────────────────────────────────────

export async function toggleLeaderboard(
  adminCode: string,
  visible: boolean
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const payload = {
    event_id: auth.eventId,
    leaderboard_visible: visible,
    updated_at: new Date().toISOString(),
  };

  const { data: existingSettings } = await supabase
    .from("hackathon_settings")
    .select("id")
    .eq("event_id", auth.eventId)
    .limit(1);

  const { error } = existingSettings?.[0]
    ? await supabase
        .from("hackathon_settings")
        .update(payload)
        .eq("id", existingSettings[0].id)
    : await supabase
        .from("hackathon_settings")
        .insert(payload);

  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true };
}

// ─── Admin: lock / unlock a team ──────────────────────────────────────────────

export async function adminSetTeamLock(
  adminCode: string,
  teamId: string,
  locked: boolean
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("hackathon_teams")
    .update({ locked_at: locked ? new Date().toISOString() : null })
    .eq("id", teamId)
    .eq("event_id", auth.eventId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true };
}

export async function adminReviewTeamIcon(
  adminCode: string,
  teamId: string,
  status: "approved" | "rejected"
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const { data: team } = await supabase
    .from("hackathon_teams")
    .select("icon_photo_id")
    .eq("id", teamId)
    .eq("event_id", auth.eventId)
    .maybeSingle();

  if (!team?.icon_photo_id) return { error: "Team does not have an icon to review." };

  const { error } = await supabase
    .from("event_photos")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", team.icon_photo_id)
    .eq("event_id", auth.eventId)
    .eq("photo_usage", "hackathon_team_icon");

  if (error) return { error: error.message };

  revalidatePath(`/admin/${adminCode}/hackathon`);
  revalidatePath(`/${auth.eventSlug}/hackathon`);
  return { success: true };
}

// ─── Admin: save score for a team ─────────────────────────────────────────────

export async function saveHackathonScore(
  adminCode: string,
  teamId: string,
  scores: {
    innovation?: number | null;
    execution?: number | null;
    presentation?: number | null;
    ux_polish?: number | null;
    notes?: string | null;
  }
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const session = await getSession();
  const judgeId = session?.userId;
  if (!judgeId) return { error: "Not authenticated" };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("hackathon_scores")
    .upsert(
      {
        team_id: teamId,
        event_id: auth.eventId,
        judge_id: judgeId,
        ...scores,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,judge_id" }
    );

  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true };
}

// ─── Admin: remove a member from a team ───────────────────────────────────────

export async function adminRemoveTeamMember(
  adminCode: string,
  teamId: string,
  userId: string
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();

  const { data: team, error: teamError } = await supabase
    .from("hackathon_teams")
    .select("created_by")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) return { error: teamError.message };
  if (!team) return { error: "Team not found" };

  const { error } = await supabase
    .from("hackathon_team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  // If team is now empty, delete it
  const { count } = await supabase
    .from("hackathon_team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  if ((count ?? 0) === 0) {
    await supabase.from("hackathon_teams").delete().eq("id", teamId);
  }

  revalidatePath(`/admin/${adminCode}/hackathon`);
  return { success: true };
}

// ─── Admin: create a team on behalf of attendees ──────────────────────────────

export async function adminCreateTeam(
  adminCode: string,
  teamName: string,
  memberUserIds: string[]
): Promise<{ success?: true; error?: string; teamId?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  if (!teamName.trim()) return { error: "Team name is required" };
  if (memberUserIds.length === 0) return { error: "Select at least one member" };

  const supabase = await createServiceClient();

  // First member is the nominal leader / creator
  const { data: team, error: teamError } = await supabase
    .from("hackathon_teams")
    .insert({
      event_id: auth.eventId,
      name: teamName.trim(),
      created_by: memberUserIds[0],
    })
    .select("id")
    .single();

  if (teamError || !team) return { error: teamError?.message ?? "Failed to create team" };

  const memberRows = memberUserIds.map((userId, i) => ({
    team_id: team.id,
    user_id: userId,
    role: i === 0 ? ("leader" as const) : ("member" as const),
  }));

  const { error: memberError } = await supabase
    .from("hackathon_team_members")
    .insert(memberRows);

  if (memberError) {
    await supabase.from("hackathon_teams").delete().eq("id", team.id);
    return { error: memberError.message };
  }

  await ensureTeamChannel(auth.eventId, team.id, teamName.trim());

  revalidatePath(`/admin/${adminCode}/hackathon`);
  revalidatePath(`/${auth.eventSlug}/hackathon`);
  return { success: true, teamId: team.id };
}

// ─── Admin: dissolve a team back into the open pool ───────────────────────────

export async function adminDissolveTeam(
  adminCode: string,
  teamId: string
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const { data: team } = await supabase
    .from("hackathon_teams")
    .select("id")
    .eq("id", teamId)
    .eq("event_id", auth.eventId)
    .maybeSingle();

  if (!team) return { error: "Team not found" };

  const { error } = await supabase
    .from("hackathon_teams")
    .delete()
    .eq("id", teamId)
    .eq("event_id", auth.eventId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/${adminCode}/hackathon`);
  revalidatePath(`/${auth.eventSlug}/hackathon`);
  return { success: true };
}

const PENDING_INVITE_TEAM_CATEGORY = "pending_invite";

// ─── Attendee: send team invite ────────────────────────────────────────────────
// If teamName is provided and user has no team, creates a hidden pending team.

export async function sendTeamInvite(
  eventId: string,
  invitedUserId: string,
  teamName?: string
): Promise<{ success?: true; error?: string; teamId?: string }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };
  const userId = session.userId;

  if (userId === invitedUserId) return { error: "Cannot invite yourself" };

  const supabase = await createServiceClient();

  // Verify hackathon mode and formation window
  const { data: event } = await supabase
    .from("events")
    .select("is_hackathon")
    .eq("id", eventId)
    .single();
  if (!event?.is_hackathon) return { error: "Hackathon mode is not active" };

  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!isFormationOpen(settings as HackathonSettings | null)) {
    return { error: "Team formation is closed" };
  }

  // Check if invited user is already on a team for this event (two-step)
  const { data: existingEventTeams } = await supabase
    .from("hackathon_teams")
    .select("id")
    .eq("event_id", eventId);
  const existingTeamIds = (existingEventTeams ?? []).map((t: { id: string }) => t.id);
  const { data: existingMembershipRows } = existingTeamIds.length
    ? await supabase
        .from("hackathon_team_members")
        .select("team_id")
        .eq("user_id", invitedUserId)
        .in("team_id", existingTeamIds)
        .limit(1)
    : { data: [] };
  const existingMembership = existingMembershipRows?.[0] ?? null;

  if (existingMembership) return { error: "That person is already on a team" };

  const { data: existingInviteFromMe } = await supabase
    .from("hackathon_team_invites")
    .select("id")
    .eq("event_id", eventId)
    .eq("invited_by", userId)
    .eq("invited_user_id", invitedUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInviteFromMe) return { error: "Invite already sent" };

  // Find or create my team
  let teamId: string;
  let createdPendingTeam = false;

  // Two-step: get event teams → find my membership
  const { data: eventTeamRows } = await supabase
    .from("hackathon_teams")
    .select("id, locked_at")
    .eq("event_id", eventId);

  const eventTeamMap = new Map<string, { locked_at: string | null }>(
    (eventTeamRows ?? []).map((t: { id: string; locked_at: string | null }) => [t.id, t])
  );

  const { data: myMembershipRows } = await supabase
    .from("hackathon_team_members")
    .select("team_id")
    .eq("user_id", userId)
    .in("team_id", [...eventTeamMap.keys()])
    .limit(1);
  const myMembership = myMembershipRows?.[0] ?? null;

  if (myMembership) {
    teamId = myMembership.team_id;
  } else {
    // Create a hidden pending team. It becomes a real team only after the invitee accepts.
    if (!teamName?.trim()) return { error: "Team name is required" };

    const { data: newTeam, error: teamError } = await supabase
      .from("hackathon_teams")
      .insert({
        event_id: eventId,
        name: teamName.trim(),
        created_by: userId,
        category: PENDING_INVITE_TEAM_CATEGORY,
      })
      .select("id")
      .single();

    if (teamError || !newTeam) return { error: teamError?.message ?? "Failed to create team" };
    teamId = newTeam.id;
    createdPendingTeam = true;
  }

  // Check team size limit
  const maxSize = (settings as HackathonSettings | null)?.max_team_size ?? 4;
  const { count: memberCount } = await supabase
    .from("hackathon_team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  if ((memberCount ?? 0) >= maxSize) {
    return { error: `Team is full (max ${maxSize} members)` };
  }

  // Check for existing pending invite
  const { data: existingInvite } = await supabase
    .from("hackathon_team_invites")
    .select("id")
    .eq("team_id", teamId)
    .eq("invited_user_id", invitedUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) return { error: "Invite already sent" };

  // Get team name and inviter name for notification
  const { data: teamRow } = await supabase
    .from("hackathon_teams")
    .select("name")
    .eq("id", teamId)
    .maybeSingle();

  const { data: inviterRow } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .maybeSingle();

  const { error: inviteError } = await supabase
    .from("hackathon_team_invites")
    .insert({
      team_id: teamId,
      event_id: eventId,
      invited_by: userId,
      invited_user_id: invitedUserId,
      status: "pending",
    });

  if (inviteError) {
    if (createdPendingTeam) {
      await supabase.from("hackathon_teams").delete().eq("id", teamId);
    }
    return { error: inviteError.message };
  }

  // Create in-app notification for invited user
  const { data: eventRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  const eventSlug = eventRow?.slug;
  await supabase.from("in_app_notifications").insert({
    user_id: invitedUserId,
    event_id: eventId,
    type: "team_invite",
    title: "Team Invite",
    body: `${inviterRow?.name ?? "Someone"} invited you to join "${teamRow?.name ?? "a team"}"`,
    action_url: `/${eventSlug}/hackathon`,
  });

  revalidatePath(`/${eventSlug}/hackathon`);
  return { success: true, teamId };
}

// ─── Attendee: accept invite ───────────────────────────────────────────────────

export async function acceptTeamInvite(
  inviteId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const userId = session.userId;

  const supabase = await createServiceClient();

  const { data: invite, error: inviteError } = await supabase
    .from("hackathon_team_invites")
    .select("*, hackathon_teams(event_id, locked_at, name, category)")
    .eq("id", inviteId)
    .eq("invited_user_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteError) return { error: inviteError.message };
  if (!invite) return { error: "Invite not found" };

  const team = invite.hackathon_teams as {
    event_id: string;
    locked_at: string | null;
    name: string;
    category: string | null;
  } | null;
  if (!team) return { error: "Team not found" };

  const eventId = team.event_id;

  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!isFormationOpen(settings as HackathonSettings | null)) {
    return { error: "Team formation is closed" };
  }

  // Check if already on a team for this event (two-step)
  const { data: eventTeamCheck } = await supabase
    .from("hackathon_teams")
    .select("id")
    .eq("event_id", eventId);
  const eventTeamCheckIds = (eventTeamCheck ?? []).map((t: { id: string }) => t.id);
  const { data: existingRows } = eventTeamCheckIds.length
    ? await supabase
        .from("hackathon_team_members")
        .select("team_id")
        .eq("user_id", userId)
        .in("team_id", eventTeamCheckIds)
        .limit(1)
    : { data: [] };
  const existing = existingRows?.[0] ?? null;

  if (existing) return { error: "You are already on a team" };

  const isPendingInviteTeam = team.category === PENDING_INVITE_TEAM_CATEGORY;

  if (isPendingInviteTeam) {
    const { data: inviterMembershipRows } = eventTeamCheckIds.length
      ? await supabase
          .from("hackathon_team_members")
          .select("team_id")
          .eq("user_id", invite.invited_by)
          .in("team_id", eventTeamCheckIds)
          .neq("team_id", invite.team_id)
          .limit(1)
      : { data: [] };
    const inviterMembership = inviterMembershipRows?.[0] ?? null;

    if (inviterMembership) {
      await supabase
        .from("hackathon_team_invites")
        .update({ status: "declined", updated_at: new Date().toISOString() })
        .eq("id", inviteId);
      return { error: "The inviter is already on another team" };
    }
  }

  // Check team size
  const maxSize = (settings as HackathonSettings | null)?.max_team_size ?? 4;
  const { count } = await supabase
    .from("hackathon_team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", invite.team_id);

  if (isPendingInviteTeam && maxSize < 2) return { error: "Team is full" };
  if (!isPendingInviteTeam && (count ?? 0) >= maxSize) return { error: "Team is full" };

  // Activate pending teams only after the invitee accepts.
  const memberRows = isPendingInviteTeam
    ? [
        { team_id: invite.team_id, user_id: invite.invited_by, role: "leader" },
        { team_id: invite.team_id, user_id: userId, role: "member" },
      ]
    : [{ team_id: invite.team_id, user_id: userId, role: "member" }];

  const { error: memberError } = await supabase
    .from("hackathon_team_members")
    .insert(memberRows);
  if (memberError) return { error: memberError.message };

  if (isPendingInviteTeam) {
    const { error: teamError } = await supabase
      .from("hackathon_teams")
      .update({ category: null, updated_at: new Date().toISOString() })
      .eq("id", invite.team_id);

    if (teamError) return { error: teamError.message };

    await ensureTeamChannel(eventId, invite.team_id, team.name);
  }

  // Mark invite accepted + decline other pending invites for this user in this event
  await supabase
    .from("hackathon_team_invites")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", inviteId);

  await supabase
    .from("hackathon_team_invites")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("invited_user_id", userId)
    .eq("event_id", eventId)
    .eq("status", "pending")
    .neq("id", inviteId);

  if (isPendingInviteTeam) {
    const { data: pendingTeams } = await supabase
      .from("hackathon_teams")
      .select("id")
      .eq("event_id", eventId)
      .eq("created_by", invite.invited_by)
      .eq("category", PENDING_INVITE_TEAM_CATEGORY)
      .neq("id", invite.team_id);

    const stalePendingTeamIds = (pendingTeams ?? []).map((row: { id: string }) => row.id);
    if (stalePendingTeamIds.length > 0) {
      await supabase
        .from("hackathon_team_invites")
        .update({ status: "declined", updated_at: new Date().toISOString() })
        .in("team_id", stalePendingTeamIds)
        .eq("status", "pending");

      await supabase
        .from("hackathon_teams")
        .delete()
        .in("id", stalePendingTeamIds);
    }
  }

  const { data: slugRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  if (slugRow?.slug) revalidatePath(`/${slugRow.slug}/hackathon`);
  return { success: true };
}

// ─── Attendee: decline invite ──────────────────────────────────────────────────

export async function declineTeamInvite(
  inviteId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();
  const { data: invite } = await supabase
    .from("hackathon_team_invites")
    .select("team_id, hackathon_teams(category)")
    .eq("id", inviteId)
    .eq("invited_user_id", session.userId)
    .eq("status", "pending")
    .maybeSingle();

  const { error } = await supabase
    .from("hackathon_team_invites")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("invited_user_id", session.userId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  const team = invite?.hackathon_teams as { category: string | null } | null | undefined;
  if (invite?.team_id && team?.category === PENDING_INVITE_TEAM_CATEGORY) {
    // Only delete the pending team if no other pending invites remain for it
    const { count: remainingInvites } = await supabase
      .from("hackathon_team_invites")
      .select("id", { count: "exact", head: true })
      .eq("team_id", invite.team_id)
      .eq("status", "pending")
      .neq("id", inviteId);

    if ((remainingInvites ?? 0) === 0) {
      await supabase.from("hackathon_teams").delete().eq("id", invite.team_id);
    }
  }

  return { success: true };
}

// ─── Attendee: leave team ─────────────────────────────────────────────────────

export async function leaveTeam(
  teamId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const userId = session.userId;

  const supabase = await createServiceClient();

  const { data: team, error: teamError } = await supabase
    .from("hackathon_teams")
    .select("event_id, locked_at")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) return { error: teamError.message };
  if (!team) return { error: "Team not found" };

  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("*")
    .eq("event_id", team.event_id)
    .maybeSingle();

  if (!isFormationOpen(settings as HackathonSettings | null)) {
    return { error: "Team formation is closed — you cannot leave your team" };
  }

  // Leaders must dissolve the team rather than leave it with members behind
  const { data: myMembership } = await supabase
    .from("hackathon_team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (myMembership?.role === "leader") {
    const { count: memberCount } = await supabase
      .from("hackathon_team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);

    if ((memberCount ?? 0) > 1) {
      return { error: "You are the team leader — dissolve the team if you want to leave" };
    }
  }

  const { error } = await supabase
    .from("hackathon_team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  // If team is now empty, delete it
  const { count } = await supabase
    .from("hackathon_team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  if ((count ?? 0) === 0) {
    await supabase.from("hackathon_teams").delete().eq("id", teamId);
  }

  const { data: slugRow } = await supabase.from("events").select("slug").eq("id", team.event_id).maybeSingle();
  if (slugRow?.slug) revalidatePath(`/${slugRow.slug}/hackathon`);
  return { success: true };
}

// ─── Attendee: dissolve their whole team back into the open pool ──────────────

export async function dissolveTeam(
  teamId: string
): Promise<{ success?: true; error?: string; dissolvedByName?: string; teamName?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: team } = await supabase
    .from("hackathon_teams")
    .select("event_id, name")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) return { error: "Team not found" };
  if (session.eventId !== team.event_id) return { error: "Not authorized for this event" };

  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("*")
    .eq("event_id", team.event_id)
    .maybeSingle();

  if (!isFormationOpen(settings as HackathonSettings | null)) {
    return { error: "Team formation is closed — you cannot dissolve your team" };
  }

  const { data: membership } = await supabase
    .from("hackathon_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!membership) return { error: "You are not on this team" };

  const { data: dissolvedBy } = await supabase
    .from("users")
    .select("name")
    .eq("id", session.userId)
    .maybeSingle();

  const { error } = await supabase
    .from("hackathon_teams")
    .delete()
    .eq("id", teamId)
    .eq("event_id", team.event_id);

  if (error) return { error: error.message };

  const { data: slugRow } = await supabase.from("events").select("slug").eq("id", team.event_id).maybeSingle();
  if (slugRow?.slug) revalidatePath(`/${slugRow.slug}/hackathon`);
  return { success: true, dissolvedByName: dissolvedBy?.name ?? "Someone", teamName: team.name };
}

// ─── Attendee: submit / update project ────────────────────────────────────────

export async function submitHackathonProject(
  teamId: string,
  eventId: string,
  data: {
    name: string;
    description?: string;
    repo_url?: string;
    demo_url?: string;
  }
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  // Verify user is on the team
  const { data: membership } = await supabase
    .from("hackathon_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!membership) return { error: "You are not on this team" };

  // Enforce submission deadline and min team size
  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("submission_deadline, min_team_size")
    .eq("event_id", eventId)
    .maybeSingle();

  if (settings?.submission_deadline && new Date(settings.submission_deadline) < new Date()) {
    return { error: "The submission deadline has passed" };
  }

  if (settings?.min_team_size && settings.min_team_size > 1) {
    const { count: memberCount } = await supabase
      .from("hackathon_team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);
    if ((memberCount ?? 0) < settings.min_team_size) {
      return { error: `Your team needs at least ${settings.min_team_size} members to submit` };
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("hackathon_projects")
    .upsert(
      {
        team_id: teamId,
        event_id: eventId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        repo_url: data.repo_url?.trim() || null,
        demo_url: data.demo_url?.trim() || null,
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: "team_id" }
    );

  if (error) return { error: error.message };

  const { data: slugRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  if (slugRow?.slug) revalidatePath(`/${slugRow.slug}/hackathon`);
  return { success: true };
}
