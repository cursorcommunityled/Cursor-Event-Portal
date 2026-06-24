"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import type { HackathonPrize, HackathonSettings, HackathonTeamWithMembers, HackathonTeamInvite, HackathonScore } from "@/types";
import type { HackathonScoreCategoryKey } from "@/lib/hackathon-rubric";
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

const PROJECT_JUDGING_LOCK_BUFFER_MS = 5 * 60 * 1000;
const TEAM_NAME_MAX_LENGTH = 60;
const PENDING_INVITE_TEAM_CATEGORY = "pending_invite";
const MAX_PAID_PLACES = 10;

function getProjectSubmissionCutoff(settings: Pick<HackathonSettings, "submission_deadline" | "judging_starts_at"> | null): Date | null {
  if (settings?.judging_starts_at) {
    return new Date(new Date(settings.judging_starts_at).getTime() - PROJECT_JUDGING_LOCK_BUFFER_MS);
  }
  return settings?.submission_deadline ? new Date(settings.submission_deadline) : null;
}

function isProjectSubmissionOpen(
  settings: Pick<HackathonSettings, "submission_deadline" | "judging_starts_at"> | null,
  now = new Date()
): boolean {
  const cutoff = getProjectSubmissionCutoff(settings);
  return !cutoff || now < cutoff;
}

function getTeamChannelName(teamName: string): string {
  return `team-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function normalizePrizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.round(next) : null;
}

function normalizeFinalRoundPrizes(paidPlaces: number, prizes: HackathonPrize[]): HackathonPrize[] {
  const clampedPaidPlaces = Math.min(Math.max(Math.floor(paidPlaces || 1), 1), MAX_PAID_PLACES);
  const byPlacement = new Map(prizes.map((prize) => [Number(prize.placement), prize]));

  return Array.from({ length: clampedPaidPlaces }, (_, index) => {
    const placement = index + 1;
    const existing = byPlacement.get(placement);
    return {
      placement,
      label: existing?.label?.trim() || `${placement}${placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th"} Place`,
      cashValue: normalizePrizeNumber(existing?.cashValue),
      cursorCredits: normalizePrizeNumber(existing?.cursorCredits),
      notes: existing?.notes?.trim() || null,
      isPublic: existing?.isPublic ?? true,
    };
  });
}

async function saveRepoSubmissionBackup(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  data: {
    eventId: string;
    teamId: string;
    submittedBy: string;
    teamName: string | null;
    projectName: string;
    description: string | null;
    repoUrl: string;
    demoUrl: string | null;
    submittedAt: string;
    primaryProjectSaved: boolean;
    primaryProjectError: string | null;
  }
): Promise<{ saved: boolean; error?: string }> {
  const { error } = await supabase
    .from("hackathon_repo_submission_backups")
    .upsert(
      {
        event_id: data.eventId,
        team_id: data.teamId,
        submitted_by: data.submittedBy,
        team_name: data.teamName,
        project_name: data.projectName,
        description: data.description,
        repo_url: data.repoUrl,
        demo_url: data.demoUrl,
        primary_project_saved: data.primaryProjectSaved,
        primary_project_error: data.primaryProjectError,
        submission_payload: {
          name: data.projectName,
          description: data.description,
          repo_url: data.repoUrl,
          demo_url: data.demoUrl,
          submitted_at: data.submittedAt,
        },
        submitted_at: data.submittedAt,
        updated_at: data.submittedAt,
      },
      { onConflict: "event_id,team_id" }
    );

  return error ? { saved: false, error: error.message } : { saved: true };
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
    ai_scores_visible?: boolean;
    audience_favorite_results_visible?: boolean;
    final_round_paid_places?: number;
    final_round_prizes?: HackathonPrize[];
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

export async function toggleAIScoresVisibility(
  adminCode: string,
  visible: boolean
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const payload = {
    event_id: auth.eventId,
    ai_scores_visible: visible,
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
  revalidatePath(`/${auth.eventSlug}/hackathon`);
  return { success: true };
}

export async function toggleAudienceFavoriteResultsVisibility(
  adminCode: string,
  visible: boolean
): Promise<{ success?: true; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const payload = {
    event_id: auth.eventId,
    audience_favorite_results_visible: visible,
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

  await supabase
    .from("polls")
    .update({ show_results: visible })
    .eq("event_id", auth.eventId)
    .eq("hackathon_audience_vote", true)
    .eq("is_active", true);

  revalidatePath(`/admin/${adminCode}/hackathon`);
  revalidatePath(`/${auth.eventSlug}/hackathon`);
  revalidatePath(`/${auth.eventSlug}`);
  return { success: true };
}

export async function saveFinalRoundPrizeSettings(
  adminCode: string,
  paidPlaces: number,
  prizes: HackathonPrize[]
): Promise<{ success?: true; prizes?: HackathonPrize[]; error?: string }> {
  const auth = await validateAdmin(adminCode);
  if (!auth.valid) return { error: auth.error };

  const clampedPaidPlaces = Math.min(Math.max(Math.floor(paidPlaces || 1), 1), MAX_PAID_PLACES);
  const normalizedPrizes = normalizeFinalRoundPrizes(clampedPaidPlaces, prizes);
  const supabase = await createServiceClient();
  const payload = {
    event_id: auth.eventId,
    final_round_paid_places: clampedPaidPlaces,
    final_round_prizes: normalizedPrizes,
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
  revalidatePath(`/${auth.eventSlug}/hackathon`);
  return { success: true, prizes: normalizedPrizes };
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
  scores: Partial<Record<HackathonScoreCategoryKey, number | null>> & { notes?: string | null }
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

// ─── Attendee: create a solo team (teams of 1) ─────────────────────────────────

export async function createSoloTeam(
  eventId: string,
  teamName: string
): Promise<{ success?: true; error?: string; teamId?: string }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };
  const userId = session.userId;

  const name = teamName?.trim();
  if (!name) return { error: "Team name is required" };

  const supabase = await createServiceClient();

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

  // Already on a team for this event?
  const { data: eventTeams } = await supabase
    .from("hackathon_teams")
    .select("id")
    .eq("event_id", eventId);
  const eventTeamIds = (eventTeams ?? []).map((t: { id: string }) => t.id);
  const { data: existingRows } = eventTeamIds.length
    ? await supabase
        .from("hackathon_team_members")
        .select("team_id")
        .eq("user_id", userId)
        .in("team_id", eventTeamIds)
        .limit(1)
    : { data: [] };
  if (existingRows?.[0]) return { error: "You are already on a team" };

  // Create the team (active immediately) with the creator as leader.
  const { data: newTeam, error: teamError } = await supabase
    .from("hackathon_teams")
    .insert({ event_id: eventId, name, created_by: userId })
    .select("id")
    .single();
  if (teamError || !newTeam) return { error: teamError?.message ?? "Failed to create team" };

  const { error: memberError } = await supabase
    .from("hackathon_team_members")
    .insert({ team_id: newTeam.id, user_id: userId, role: "leader" });
  if (memberError) {
    await supabase.from("hackathon_teams").delete().eq("id", newTeam.id);
    return { error: memberError.message };
  }

  await ensureTeamChannel(eventId, newTeam.id, name);

  const { data: eventRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  if (eventRow?.slug) revalidatePath(`/${eventRow.slug}/hackathon`);

  return { success: true, teamId: newTeam.id };
}

// ─── Attendee: cancel sent team invite ─────────────────────────────────────────

export async function cancelTeamInvite(
  eventId: string,
  invitedUserId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };

  const supabase = await createServiceClient();
  const { data: invite, error: inviteError } = await supabase
    .from("hackathon_team_invites")
    .select("id, team_id, team:hackathon_teams(category)")
    .eq("event_id", eventId)
    .eq("invited_by", session.userId)
    .eq("invited_user_id", invitedUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteError) return { error: inviteError.message };
  if (!invite) return { error: "Invite not found" };

  const { error } = await supabase
    .from("hackathon_team_invites")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", invite.id)
    .eq("invited_by", session.userId);

  if (error) return { error: error.message };

  const team = invite.team as unknown as { category: string | null } | null;
  if (invite.team_id && team?.category === PENDING_INVITE_TEAM_CATEGORY) {
    const { count: remainingInvites } = await supabase
      .from("hackathon_team_invites")
      .select("id", { count: "exact", head: true })
      .eq("team_id", invite.team_id)
      .eq("status", "pending");

    if ((remainingInvites ?? 0) === 0) {
      await supabase.from("hackathon_teams").delete().eq("id", invite.team_id);
    }
  }

  const { data: eventRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  if (eventRow?.slug) revalidatePath(`/${eventRow.slug}/hackathon`);
  return { success: true };
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

// ─── Attendee: rename team ─────────────────────────────────────────────────────

export async function renameTeam(
  teamId: string,
  eventId: string,
  teamName: string
): Promise<{ success?: true; error?: string; name?: string }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };

  const nextName = teamName.trim();
  if (!nextName) return { error: "Team name is required" };
  if (nextName.length > TEAM_NAME_MAX_LENGTH) {
    return { error: `Team name must be ${TEAM_NAME_MAX_LENGTH} characters or fewer` };
  }

  const supabase = await createServiceClient();

  const { data: team, error: teamError } = await supabase
    .from("hackathon_teams")
    .select("id, event_id, name, category")
    .eq("id", teamId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (teamError) return { error: teamError.message };
  if (!team) return { error: "Team not found" };
  if (team.category === PENDING_INVITE_TEAM_CATEGORY) {
    return { error: "This team is still pending an accepted invite" };
  }

  const { data: membership } = await supabase
    .from("hackathon_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!membership) return { error: "You are not on this team" };

  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!isFormationOpen(settings as HackathonSettings | null)) {
    return { error: "Team formation is closed — you cannot rename your team" };
  }

  if (team.name === nextName) return { success: true, name: nextName };

  const { data: updatedTeam, error } = await supabase
    .from("hackathon_teams")
    .update({ name: nextName, updated_at: new Date().toISOString() })
    .eq("id", teamId)
    .eq("event_id", eventId)
    .select("name")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updatedTeam) return { error: "Team name could not be updated" };

  await supabase
    .from("hackathon_chat_channels")
    .update({ name: getTeamChannelName(nextName) })
    .eq("event_id", eventId)
    .eq("team_id", teamId)
    .eq("channel_type", "team");

  const { data: slugRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  if (slugRow?.slug) revalidatePath(`/${slugRow.slug}/hackathon`);
  return { success: true, name: updatedTeam.name };
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

// ─── Attendee: submit / cancel project ────────────────────────────────────────

export async function submitHackathonProject(
  teamId: string,
  eventId: string,
  data: {
    name: string;
    description?: string;
    repo_url?: string;
    demo_url?: string;
  }
): Promise<{ success?: true; error?: string; fallback?: boolean; warning?: string }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const projectName = data.name.trim();
  const description = data.description?.trim() || null;
  const repoUrl = data.repo_url?.trim() || null;
  const demoUrl = data.demo_url?.trim() || null;

  if (!projectName) return { error: "Project name is required" };

  const { data: team } = await supabase
    .from("hackathon_teams")
    .select("id, name")
    .eq("id", teamId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!team) return { error: "Team not found" };

  // Verify user is on the team
  const { data: membership } = await supabase
    .from("hackathon_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!membership) return { error: "You are not on this team" };

  // Enforce submission cutoff and min team size
  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("submission_deadline, judging_starts_at, min_team_size")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!isProjectSubmissionOpen(settings as Pick<HackathonSettings, "submission_deadline" | "judging_starts_at"> | null)) {
    return { error: "Project submissions are locked for judging" };
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

  const { data: existingProject, error: existingProjectError } = await supabase
    .from("hackathon_projects")
    .select("id, submitted_at")
    .eq("team_id", teamId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingProjectError) return { error: existingProjectError.message };

  if (existingProject?.submitted_at) {
    return { error: "This team already has a submitted project. Cancel it before submitting changes." };
  }

  const now = new Date().toISOString();
  const payload = {
    team_id: teamId,
    event_id: eventId,
    name: projectName,
    description,
    repo_url: repoUrl,
    demo_url: demoUrl,
    submitted_at: now,
    updated_at: now,
  };

  const { error } = existingProject
    ? await supabase
        .from("hackathon_projects")
        .update(payload)
        .eq("id", existingProject.id)
        .is("submitted_at", null)
    : await supabase
        .from("hackathon_projects")
        .insert({
          ...payload,
          created_at: now,
        });

  if (error?.code === "23505") {
    return { error: "This team already has a submitted project. Refresh to see the latest submission." };
  }

  if (!error && existingProject) {
    const { data: savedProject } = await supabase
      .from("hackathon_projects")
      .select("id")
      .eq("id", existingProject.id)
      .eq("submitted_at", now)
      .maybeSingle();

    if (!savedProject) {
      return { error: "This team already has a submitted project. Refresh to see the latest submission." };
    }
  }

  const backup = repoUrl
    ? await saveRepoSubmissionBackup(supabase, {
        eventId,
        teamId,
        submittedBy: session.userId,
        teamName: team.name ?? null,
        projectName,
        description,
        repoUrl,
        demoUrl,
        submittedAt: now,
        primaryProjectSaved: !error,
        primaryProjectError: error?.message ?? null,
      })
    : null;

  if (error) {
    if (backup?.saved) {
      const { data: slugRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
      if (slugRow?.slug) revalidatePath(`/${slugRow.slug}/hackathon`);
      return {
        success: true,
        fallback: true,
        warning: "Repo saved to the admin backup file, but the project card did not update.",
      };
    }

    return { error: error.message };
  }

  const { data: slugRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  if (slugRow?.slug) revalidatePath(`/${slugRow.slug}/hackathon`);
  return { success: true };
}

export async function cancelHackathonProjectSubmission(
  teamId: string,
  eventId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: membership } = await supabase
    .from("hackathon_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!membership) return { error: "You are not on this team" };

  const { data: team } = await supabase
    .from("hackathon_teams")
    .select("id, event_id")
    .eq("id", teamId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!team) return { error: "Team not found" };

  const { data: settings } = await supabase
    .from("hackathon_settings")
    .select("submission_deadline, judging_starts_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!isProjectSubmissionOpen(settings as Pick<HackathonSettings, "submission_deadline" | "judging_starts_at"> | null)) {
    return { error: "Project submissions can no longer be cancelled because judging is about to begin" };
  }

  const { data: project, error: projectError } = await supabase
    .from("hackathon_projects")
    .select("id, submitted_at")
    .eq("team_id", teamId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (projectError) return { error: projectError.message };
  if (!project?.submitted_at) return { error: "There is no submitted project to cancel" };

  const { data: cancelledProject, error } = await supabase
    .from("hackathon_projects")
    .update({
      submitted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id)
    .eq("submitted_at", project.submitted_at)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!cancelledProject) return { error: "This submission has already changed. Refresh to see the latest project status." };

  const { data: slugRow } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  if (slugRow?.slug) revalidatePath(`/${slugRow.slug}/hackathon`);
  return { success: true };
}
