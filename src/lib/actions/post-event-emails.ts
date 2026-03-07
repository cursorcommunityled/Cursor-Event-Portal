"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import {
  buildHostBlastEmail,
  buildSurveyEmail,
  buildConnectionRecommendEmail,
  type PostEventEmailMode,
} from "@/lib/email/post-event";

export type { PostEventEmailMode };

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

const FROM = "Cursor Pop-Up <onboarding@resend.dev>";

// ─── Admin auth helper ────────────────────────────────────────────────────────

async function validateAdmin(supabase: Awaited<ReturnType<typeof createServiceClient>>, adminCode: string) {
  const { data: event } = await supabase
    .from("events")
    .select("id, name, admin_code")
    .eq("admin_code", adminCode)
    .single();

  if (!event || event.admin_code !== adminCode) return null;
  return event as { id: string; name: string; admin_code: string };
}

// ─── Fetch group + intake data ────────────────────────────────────────────────

interface MemberData {
  userId: string;
  name: string;
  email: string | null;
  groupId: string;
  groupName: string;
  matchReason: string | null;
  followupConsent: boolean;
  linkedin: string | null;
  github: string | null;
  website: string | null;
}

async function fetchGroupMemberData(supabase: Awaited<ReturnType<typeof createServiceClient>>, eventId: string): Promise<MemberData[]> {
  // Fetch approved groups with members and user info
  const { data: groups, error } = await supabase
    .from("suggested_groups")
    .select(`
      id, name,
      members:suggested_group_members(
        user_id, match_reason,
        user:users(id, name, email)
      )
    `)
    .eq("event_id", eventId)
    .eq("status", "approved");

  if (error || !groups) return [];

  // Collect all user IDs
  const allUserIds = groups.flatMap((g: any) =>
    (g.members || []).map((m: any) => m.user_id)
  );

  if (allUserIds.length === 0) return [];

  // Fetch intakes for all users in this event
  const { data: intakes } = await supabase
    .from("attendee_intakes")
    .select("user_id, linkedin, github, website, followup_consent")
    .eq("event_id", eventId)
    .in("user_id", allUserIds);

  const intakeMap = new Map<string, { linkedin: string | null; github: string | null; website: string | null; followup_consent: boolean }>();
  for (const intake of intakes || []) {
    intakeMap.set(intake.user_id, {
      linkedin: intake.linkedin ?? null,
      github: intake.github ?? null,
      website: intake.website ?? null,
      followup_consent: intake.followup_consent === true,
    });
  }

  const members: MemberData[] = [];
  for (const group of groups as any[]) {
    for (const member of group.members || []) {
      const user = Array.isArray(member.user) ? member.user[0] : member.user;
      const intake = intakeMap.get(member.user_id);
      members.push({
        userId: member.user_id,
        name: user?.name ?? "Unknown",
        email: user?.email ?? null,
        groupId: group.id,
        groupName: group.name,
        matchReason: member.match_reason ?? null,
        followupConsent: intake?.followup_consent ?? false,
        linkedin: intake?.linkedin ?? null,
        github: intake?.github ?? null,
        website: intake?.website ?? null,
      });
    }
  }
  return members;
}

// ─── Stats action ─────────────────────────────────────────────────────────────

export async function getPostEventEmailStats(eventId: string, adminCode: string): Promise<{
  groups: number;
  totalMembers: number;
  eligibleRecipients: number;
  error?: string;
}> {
  try {
    const supabase = await createServiceClient();
    const event = await validateAdmin(supabase, adminCode);
    if (!event) return { groups: 0, totalMembers: 0, eligibleRecipients: 0, error: "Not authorized" };

    const members = await fetchGroupMemberData(supabase, event.id);
    const groupIds = new Set(members.map((m) => m.groupId));
    const eligible = members.filter((m) => m.email && m.followupConsent);

    return {
      groups: groupIds.size,
      totalMembers: members.length,
      eligibleRecipients: eligible.length,
    };
  } catch (e) {
    return { groups: 0, totalMembers: 0, eligibleRecipients: 0, error: String(e) };
  }
}

// ─── Send action ──────────────────────────────────────────────────────────────

export async function sendPostEventEmails(
  eventId: string,
  adminCode: string,
  mode: PostEventEmailMode,
  options?: { surveyUrl?: string }
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const supabase = await createServiceClient();
  const event = await validateAdmin(supabase, adminCode);
  if (!event) return { sent: 0, skipped: 0, errors: ["Not authorized"] };

  if (mode === "survey" && !options?.surveyUrl?.trim()) {
    return { sent: 0, skipped: 0, errors: ["Survey URL is required for survey mode"] };
  }

  const allMembers = await fetchGroupMemberData(supabase, event.id);
  if (allMembers.length === 0) return { sent: 0, skipped: 0, errors: ["No approved groups found"] };

  // Group members by their group
  const groupsMap = new Map<string, { name: string; members: MemberData[] }>();
  for (const m of allMembers) {
    if (!groupsMap.has(m.groupId)) groupsMap.set(m.groupId, { name: m.groupName, members: [] });
    groupsMap.get(m.groupId)!.members.push(m);
  }

  const resend = getResend();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [, group] of groupsMap) {
    for (const member of group.members) {
      // Must have email and consent
      if (!member.email || !member.followupConsent) {
        skipped++;
        continue;
      }

      const groupmates = group.members
        .filter((m) => m.userId !== member.userId)
        .map((m) => ({
          name: m.name,
          linkedin: m.linkedin,
          github: m.github,
          website: m.website,
          matchReason: m.matchReason,
        }));

      if (groupmates.length === 0) {
        skipped++;
        continue;
      }

      let subject: string;
      let html: string;

      if (mode === "host-blast") {
        ({ subject, html } = buildHostBlastEmail({
          recipientName: member.name,
          eventName: event.name,
          groupmates,
        }));
      } else if (mode === "survey") {
        ({ subject, html } = buildSurveyEmail({
          recipientName: member.name,
          eventName: event.name,
          groupmates,
          surveyUrl: options!.surveyUrl!.trim(),
        }));
      } else {
        // connection-recommend — only include groupmates who also consented
        const consentedGroupmates = group.members
          .filter((m) => m.userId !== member.userId && m.followupConsent)
          .map((m) => ({
            name: m.name,
            linkedin: m.linkedin,
            github: m.github,
            website: m.website,
            matchReason: m.matchReason,
          }));

        if (consentedGroupmates.length === 0) {
          skipped++;
          continue;
        }

        ({ subject, html } = buildConnectionRecommendEmail({
          recipientName: member.name,
          eventName: event.name,
          groupmates: consentedGroupmates,
        }));
      }

      try {
        const { error } = await resend.emails.send({
          from: FROM,
          to: member.email,
          subject,
          html,
        });

        if (error) {
          errors.push(`Failed to send to ${member.email}: ${error.message}`);
        } else {
          sent++;
        }
      } catch (e) {
        errors.push(`Exception sending to ${member.email}: ${String(e)}`);
      }
    }
  }

  return { sent, skipped, errors };
}
