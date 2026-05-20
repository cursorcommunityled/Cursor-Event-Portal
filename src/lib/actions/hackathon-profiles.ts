"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";
import type { HackathonProfile } from "@/types";

const TEAM_RECOMMENDATION_BATCH_SIZE = 3;

export interface TeamRecommendation {
  userId: string;
  name: string;
  occupation: string | null;
  is_technical: boolean | null;
  unique_skill: string | null;
  linkedin_url: string | null;
  profile_bio: string | null;
  project_interests: string | null;
  collaboration_style: string | null;
  looking_for_teammates: string | null;
  reason: string;
}

type RecommendationCandidate = {
  user_id: string;
  name: string;
  occupation: string | null;
  is_technical: boolean | null;
  unique_skill: string | null;
  linkedin_url: string | null;
  profile_bio: string | null;
  project_interests: string | null;
  collaboration_style: string | null;
  looking_for_teammates: string | null;
};

type ProfileContext = {
  occupation: string | null;
  is_technical: boolean | null;
  unique_skill: string | null;
  profile_bio?: string | null;
  project_interests?: string | null;
  collaboration_style?: string | null;
  looking_for_teammates?: string | null;
};

export type HackathonProfileFormInput = {
  occupation?: string | null;
  is_technical?: boolean | null;
  unique_skill?: string | null;
  linkedin_url?: string | null;
  needs_team?: boolean | null;
  profile_bio?: string | null;
  project_interests?: string | null;
  collaboration_style?: string | null;
  looking_for_teammates?: string | null;
};

function cleanText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function updateMyHackathonProfile(
  eventId: string,
  input: HackathonProfileFormInput
): Promise<{ profile?: HackathonProfile; error?: string }> {
  const session = await getSession();
  if (!session || session.eventId !== eventId) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: registration } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", session.userId)
    .not("checked_in_at", "is", null)
    .maybeSingle();

  if (!registration) return { error: "You must be checked in before editing your hackathon profile" };

  const payload = {
    user_id: session.userId,
    event_id: eventId,
    occupation: cleanText(input.occupation, 120),
    is_technical: input.is_technical ?? null,
    unique_skill: cleanText(input.unique_skill, 160),
    linkedin_url: cleanText(input.linkedin_url, 240),
    needs_team: Boolean(input.needs_team),
    profile_bio: cleanText(input.profile_bio, 600),
    project_interests: cleanText(input.project_interests, 600),
    collaboration_style: cleanText(input.collaboration_style, 400),
    looking_for_teammates: cleanText(input.looking_for_teammates, 400),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("hackathon_profiles")
    .upsert(payload, { onConflict: "user_id,event_id" })
    .select("*")
    .single();

  if (error) {
    console.error("[updateMyHackathonProfile] error:", error);
    return { error: error.message };
  }

  return { profile: data as HackathonProfile };
}

function backgroundLabel(isTechnical: boolean | null) {
  if (isTechnical === null) return null;
  return isTechnical ? "technical" : "non-technical";
}

function buildConcreteReason(candidate: RecommendationCandidate, myProfile: ProfileContext | null) {
  const mySkill = myProfile?.unique_skill;
  const myOccupation = myProfile?.occupation;
  const myBackground = backgroundLabel(myProfile?.is_technical ?? null);
  const candidateBackground = backgroundLabel(candidate.is_technical);
  const candidateFacts = [
    candidate.occupation ? `role: ${candidate.occupation}` : null,
    candidateBackground ? `${candidateBackground} background` : null,
    candidate.unique_skill ? `skill: ${candidate.unique_skill}` : null,
  ].filter(Boolean);
  const myFacts = [
    myOccupation ? `your ${myOccupation} background` : null,
    myBackground ? `your ${myBackground} perspective` : null,
    mySkill ? `your ${mySkill}` : null,
  ].filter(Boolean);

  if (candidate.unique_skill) {
    return mySkill
      ? `${candidate.name} listed ${candidate.unique_skill}; that pairs directly with your ${mySkill}.`
      : `${candidate.name} listed ${candidate.unique_skill}; useful if the team needs a clear execution owner.`;
  }

  if (candidate.occupation) {
    if (myFacts.length > 0) {
      return `${candidate.name} is a ${candidate.occupation} (${candidateBackground ?? "background unknown"}), which can round out ${myFacts.slice(0, 2).join(" + ")}.`;
    }
    return `${candidate.name} is a ${candidate.occupation}${candidateBackground ? ` with a ${candidateBackground} background` : ""}; a practical fit for research, pitching, or user validation.`;
  }

  if (candidateBackground) {
    return myBackground && myBackground !== candidateBackground
      ? `${candidate.name} adds a ${candidateBackground} perspective to balance your ${myBackground} background.`
      : `${candidate.name} brings another ${candidateBackground} builder into the unassigned pool.`;
  }

  return candidateFacts.length > 0
    ? `${candidate.name}: ${candidateFacts.join("; ")}.`
    : `${candidate.name} is checked in and unassigned, but no Luma profile details are available yet.`;
}

function reasonUsesProfileDetail(
  reason: string,
  candidate: RecommendationCandidate,
  myProfile: ProfileContext | null
) {
  const normalized = reason.toLowerCase();
  const concreteDetails = [
    candidate.occupation,
    candidate.unique_skill,
    myProfile?.occupation,
    myProfile?.unique_skill,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.toLowerCase());

  if (concreteDetails.length === 0) return !/\b(background|perspective|skills|capabilities|well-rounded|strengthen|balance)\b/i.test(reason);
  return concreteDetails.some((detail) => normalized.includes(detail));
}

export async function getTeamRecommendations(
  eventId: string,
  excludeUserIds: string[] = []
): Promise<{ recommendations: TeamRecommendation[]; needsTeam: boolean; hasMore?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { recommendations: [], needsTeam: false, error: "Not authenticated" };

  const supabase = await createServiceClient();
  const excludedUserIds = new Set(excludeUserIds.filter(Boolean));

  // Check current profile for richer matching context. Team assignment is the
  // real gate for recommendations; `needs_team` can be stale after admin changes.
  const { data: myProfile } = await supabase
    .from("hackathon_profiles")
    .select("occupation, is_technical, unique_skill, needs_team, profile_bio, project_interests, collaboration_style, looking_for_teammates")
    .eq("user_id", session.userId)
    .eq("event_id", eventId)
    .maybeSingle();

  // Check if already on a team — if so, don't recommend
  const { data: eventTeams } = await supabase
    .from("hackathon_teams")
    .select("id")
    .eq("event_id", eventId);

  const teamIds = (eventTeams ?? []).map((t: { id: string }) => t.id);
  if (teamIds.length > 0) {
    const { data: membership } = await supabase
      .from("hackathon_team_members")
      .select("id")
      .eq("user_id", session.userId)
      .in("team_id", teamIds)
      .maybeSingle();
    if (membership) return { recommendations: [], needsTeam: false };
  }

  // Get my name
  const { data: myUser } = await supabase
    .from("users")
    .select("name")
    .eq("id", session.userId)
    .maybeSingle();

  // Suggest from the actual checked-in chat roster, not a profile flag that
  // can go stale when admins manually move people between teams.
  const { data: checkedInRegs } = await supabase
    .from("registrations")
    .select("user_id, user:users!registrations_user_id_fkey(id, name)")
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null)
    .neq("user_id", session.userId);

  const checkedInUsers = (checkedInRegs ?? [])
    .map((reg) => {
      const user = Array.isArray(reg.user) ? reg.user[0] : reg.user;
      return user as { id: string; name: string } | null;
    })
    .filter((user): user is { id: string; name: string } => !!user?.id);

  if (checkedInUsers.length === 0) return { recommendations: [], needsTeam: true };

  // Filter out anyone already on a team.
  const checkedInUserIds = checkedInUsers.map((user) => user.id);
  const alreadyOnTeam = new Set<string>();
  if (teamIds.length > 0) {
    const { data: teamMembers } = await supabase
      .from("hackathon_team_members")
      .select("user_id")
      .in("team_id", teamIds)
      .in("user_id", checkedInUserIds);
    for (const m of teamMembers ?? []) alreadyOnTeam.add((m as { user_id: string }).user_id);
  }

  const candidateUsers = checkedInUsers.filter((user) => !alreadyOnTeam.has(user.id) && !excludedUserIds.has(user.id));
  if (candidateUsers.length === 0) return { recommendations: [], needsTeam: true, hasMore: false };

  const { data: candidateProfiles } = await supabase
    .from("hackathon_profiles")
    .select("user_id, occupation, is_technical, unique_skill, linkedin_url, profile_bio, project_interests, collaboration_style, looking_for_teammates")
    .eq("event_id", eventId)
    .in("user_id", candidateUsers.map((user) => user.id));

  const profileMap = new Map(
    (candidateProfiles ?? []).map((profile: {
      user_id: string;
      occupation: string | null;
      is_technical: boolean | null;
      unique_skill: string | null;
      linkedin_url: string | null;
      profile_bio: string | null;
      project_interests: string | null;
      collaboration_style: string | null;
      looking_for_teammates: string | null;
    }) => [profile.user_id, profile])
  );

  const candidates: RecommendationCandidate[] = candidateUsers.map((user) => {
    const profile = profileMap.get(user.id);
    return {
      user_id: user.id,
      name: user.name,
      occupation: profile?.occupation ?? null,
      is_technical: profile?.is_technical ?? null,
      unique_skill: profile?.unique_skill ?? null,
      linkedin_url: profile?.linkedin_url ?? null,
      profile_bio: profile?.profile_bio ?? null,
      project_interests: profile?.project_interests ?? null,
      collaboration_style: profile?.collaboration_style ?? null,
      looking_for_teammates: profile?.looking_for_teammates ?? null,
    };
  });
  if (candidates.length === 0) return { recommendations: [], needsTeam: true };

  const fallbackRecommendations = candidates.slice(0, TEAM_RECOMMENDATION_BATCH_SIZE).map((candidate) => ({
    userId: candidate.user_id,
    name: candidate.name,
    occupation: candidate.occupation,
    is_technical: candidate.is_technical,
    unique_skill: candidate.unique_skill,
    linkedin_url: candidate.linkedin_url,
    profile_bio: candidate.profile_bio,
    project_interests: candidate.project_interests,
    collaboration_style: candidate.collaboration_style,
    looking_for_teammates: candidate.looking_for_teammates,
    reason: buildConcreteReason(candidate, myProfile),
  }));

  // Build prompt
  const myDesc = [
    `Name: ${myUser?.name ?? "Me"}`,
    myProfile?.occupation ? `Occupation: ${myProfile.occupation}` : null,
    myProfile?.is_technical !== null && myProfile?.is_technical !== undefined
      ? `Background: ${myProfile.is_technical ? "Technical" : "Non-technical"}`
      : null,
    myProfile?.unique_skill ? `Unique skill: ${myProfile.unique_skill}` : null,
    myProfile?.project_interests ? `Project interests: ${myProfile.project_interests}` : null,
    myProfile?.collaboration_style ? `Collaboration style: ${myProfile.collaboration_style}` : null,
    myProfile?.looking_for_teammates ? `Looking for: ${myProfile.looking_for_teammates}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const candidateLines = candidates.map((c: {
    user_id: string;
    name: string;
    occupation: string | null;
    is_technical: boolean | null;
    unique_skill: string | null;
    project_interests: string | null;
    collaboration_style: string | null;
    looking_for_teammates: string | null;
  }) => {
    return [
      `ID: ${c.user_id}`,
      `Name: ${c.name}`,
      c.occupation ? `Occupation: ${c.occupation}` : null,
      c.is_technical !== null
        ? `Background: ${c.is_technical ? "Technical" : "Non-technical"}`
        : null,
      c.unique_skill ? `Unique skill: ${c.unique_skill}` : null,
      c.project_interests ? `Project interests: ${c.project_interests}` : null,
      c.collaboration_style ? `Collaboration style: ${c.collaboration_style}` : null,
      c.looking_for_teammates ? `Looking for: ${c.looking_for_teammates}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  });

  const prompt = `You are a hackathon team matchmaker. An attendee needs help finding teammates.

Current user: ${myDesc || "No survey profile fields available"}

Other attendees also looking for a team:
${candidateLines.join("\n")}

Return ONLY valid JSON — an array of up to ${Math.min(TEAM_RECOMMENDATION_BATCH_SIZE, candidates.length)} objects (best matches first):
[{"user_id":"...","reason":"One sentence why this match makes sense (max 140 chars)"}]

Rules for reasons:
- Mention at least one exact listed occupation or unique skill from the current user or candidate.
- If no occupation or unique skill exists, mention the technical/non-technical background explicitly.
- Do NOT use vague phrases like "background could complement", "diverse perspective", "strong technical edge", or "strengthen the project" unless tied to a specific listed field.
- Prefer practical team-role fit over generic praise.

Mix technical and non-technical backgrounds when possible. Return only the JSON array.`;

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      recommendations: fallbackRecommendations,
      needsTeam: true,
      hasMore: candidates.length > fallbackRecommendations.length,
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const firstBlock = response.content[0];
    const text = firstBlock?.type === "text" ? firstBlock.text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return {
        recommendations: fallbackRecommendations,
        needsTeam: true,
        hasMore: candidates.length > fallbackRecommendations.length,
        error: "Unexpected LLM format",
      };
    }

    const ranked = JSON.parse(jsonMatch[0]) as { user_id: string; reason: string }[];
    const candidateMap = new Map(
      candidates.map((c: {
        user_id: string;
        name: string;
        occupation: string | null;
        is_technical: boolean | null;
        unique_skill: string | null;
        linkedin_url: string | null;
        profile_bio: string | null;
        project_interests: string | null;
        collaboration_style: string | null;
        looking_for_teammates: string | null;
      }) => [c.user_id, c])
    );

    const recommendations: TeamRecommendation[] = ranked
      .slice(0, TEAM_RECOMMENDATION_BATCH_SIZE)
      .filter((r) => candidateMap.has(r.user_id))
      .map((r) => {
        const candidate = candidateMap.get(r.user_id)!;
        const reason = typeof r.reason === "string" && reasonUsesProfileDetail(r.reason, candidate, myProfile)
          ? r.reason
          : buildConcreteReason(candidate, myProfile);
        return {
          userId: r.user_id,
          name: candidate.name,
          occupation: candidate.occupation,
          is_technical: candidate.is_technical,
          unique_skill: candidate.unique_skill,
          linkedin_url: candidate.linkedin_url,
          profile_bio: candidate.profile_bio,
          project_interests: candidate.project_interests,
          collaboration_style: candidate.collaboration_style,
          looking_for_teammates: candidate.looking_for_teammates,
          reason,
        };
      });

    const usedIds = new Set(recommendations.map((recommendation) => recommendation.userId));
    for (const fallback of fallbackRecommendations) {
      if (recommendations.length >= TEAM_RECOMMENDATION_BATCH_SIZE) break;
      if (usedIds.has(fallback.userId)) continue;
      recommendations.push(fallback);
      usedIds.add(fallback.userId);
    }

    return {
      recommendations: recommendations.length > 0 ? recommendations : fallbackRecommendations,
      needsTeam: true,
      hasMore: candidates.length > Math.max(recommendations.length, fallbackRecommendations.length),
    };
  } catch (e) {
    console.error("[getTeamRecommendations] error:", e);
    return {
      recommendations: fallbackRecommendations,
      needsTeam: true,
      hasMore: candidates.length > fallbackRecommendations.length,
      error: "Failed to generate recommendations",
    };
  }
}
