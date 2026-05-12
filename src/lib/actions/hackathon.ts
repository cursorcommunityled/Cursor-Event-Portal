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

  if (data.team_formation_enabled !== false) {
    await supabase
      .from("hackathon_teams")
      .update({ locked_at: null, updated_at: new Date().toISOString() })
      .eq("event_id", auth.eventId);
  }

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

  const { data: team } = await supabase
    .from("hackathon_teams")
    .select("created_by")
    .eq("id", teamId)
    .single();

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

// ─── Attendee: send team invite ────────────────────────────────────────────────
// If teamName is provided and user has no team, creates the team first.

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

  // Find or create my team
  let teamId: string;

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
    // Need to create a team
    if (!teamName?.trim()) return { error: "Team name is required" };

    const { data: newTeam, error: teamError } = await supabase
      .from("hackathon_teams")
      .insert({ event_id: eventId, name: teamName.trim(), created_by: userId })
      .select("id")
      .single();

    if (teamError || !newTeam) return { error: teamError?.message ?? "Failed to create team" };
    teamId = newTeam.id;

    // Add creator as leader
    await supabase.from("hackathon_team_members").insert({
      team_id: teamId,
      user_id: userId,
      role: "leader",
    });

    // Auto-create private team chat channel
    await ensureTeamChannel(eventId, teamId, teamName.trim());
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
    .single();

  const { data: inviterRow } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .single();

  const { error: inviteError } = await supabase
    .from("hackathon_team_invites")
    .insert({
      team_id: teamId,
      event_id: eventId,
      invited_by: userId,
      invited_user_id: invitedUserId,
      status: "pending",
    });

  if (inviteError) return { error: inviteError.message };

  // Create in-app notification for invited user
  const eventSlug = (await supabase.from("events").select("slug").eq("id", eventId).single()).data?.slug;
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

  const { data: invite } = await supabase
    .from("hackathon_team_invites")
    .select("*, hackathon_teams(event_id, locked_at, name)")
    .eq("id", inviteId)
    .eq("invited_user_id", userId)
    .eq("status", "pending")
    .single();

  if (!invite) return { error: "Invite not found" };

  const team = invite.hackathon_teams as { event_id: string; locked_at: string | null; name: string } | null;
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

  // Check team size
  const maxSize = (settings as HackathonSettings | null)?.max_team_size ?? 4;
  const { count } = await supabase
    .from("hackathon_team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", invite.team_id);

  if ((count ?? 0) >= maxSize) return { error: "Team is full" };

  // Add member
  const { error: memberError } = await supabase
    .from("hackathon_team_members")
    .insert({ team_id: invite.team_id, user_id: userId, role: "member" });

  if (memberError) return { error: memberError.message };

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

  const eventSlug = (await supabase.from("events").select("slug").eq("id", eventId).single()).data?.slug;
  revalidatePath(`/${eventSlug}/hackathon`);
  return { success: true };
}

// ─── Attendee: decline invite ──────────────────────────────────────────────────

export async function declineTeamInvite(
  inviteId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("hackathon_team_invites")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("invited_user_id", session.userId)
    .eq("status", "pending");

  if (error) return { error: error.message };
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

  const { data: team } = await supabase
    .from("hackathon_teams")
    .select("event_id, locked_at")
    .eq("id", teamId)
    .single();

  if (!team) return { error: "Team not found" };

  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("*")
    .eq("event_id", team.event_id)
    .maybeSingle();

  if (!isFormationOpen(settings as HackathonSettings | null)) {
    return { error: "Team formation is closed — you cannot leave your team" };
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

  const eventSlug = (await supabase.from("events").select("slug").eq("id", team.event_id).single()).data?.slug;
  revalidatePath(`/${eventSlug}/hackathon`);
  return { success: true };
}

// ─── Attendee: dissolve their whole team back into the open pool ──────────────

export async function dissolveTeam(
  teamId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: team } = await supabase
    .from("hackathon_teams")
    .select("event_id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) return { error: "Team not found" };
  if (session.eventId !== team.event_id) return { error: "Not authorized for this event" };

  const { data: membership } = await supabase
    .from("hackathon_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!membership) return { error: "You are not on this team" };

  const { error } = await supabase
    .from("hackathon_teams")
    .delete()
    .eq("id", teamId)
    .eq("event_id", team.event_id);

  if (error) return { error: error.message };

  const eventSlug = (await supabase.from("events").select("slug").eq("id", team.event_id).single()).data?.slug;
  revalidatePath(`/${eventSlug}/hackathon`);
  return { success: true };
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
    video_url?: string;
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
        video_url: data.video_url?.trim() || null,
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: "team_id" }
    );

  if (error) return { error: error.message };

  const eventSlug = (await supabase.from("events").select("slug").eq("id", eventId).single()).data?.slug;
  revalidatePath(`/${eventSlug}/hackathon`);
  return { success: true };
}
