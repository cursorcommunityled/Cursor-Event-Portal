"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

export interface TeamRecommendation {
  userId: string;
  name: string;
  occupation: string | null;
  is_technical: boolean | null;
  unique_skill: string | null;
  linkedin_url: string | null;
  reason: string;
}

export async function getTeamRecommendations(
  eventId: string
): Promise<{ recommendations: TeamRecommendation[]; needsTeam: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { recommendations: [], needsTeam: false, error: "Not authenticated" };

  const supabase = await createServiceClient();

  // Check current profile for richer matching context. Team assignment is the
  // real gate for recommendations; `needs_team` can be stale after admin changes.
  const { data: myProfile } = await supabase
    .from("hackathon_profiles")
    .select("occupation, is_technical, unique_skill, needs_team")
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

  // Get other people marked as needing a team.
  const { data: others } = await supabase
    .from("hackathon_profiles")
    .select("user_id, occupation, is_technical, unique_skill, linkedin_url")
    .eq("event_id", eventId)
    .eq("needs_team", true)
    .neq("user_id", session.userId);

  if (!others || others.length === 0) return { recommendations: [], needsTeam: true };

  // Filter out anyone already on a team
  const otherUserIds = others.map((p: { user_id: string }) => p.user_id);
  const alreadyOnTeam = new Set<string>();
  if (teamIds.length > 0) {
    const { data: teamMembers } = await supabase
      .from("hackathon_team_members")
      .select("user_id")
      .in("team_id", teamIds)
      .in("user_id", otherUserIds);
    for (const m of teamMembers ?? []) alreadyOnTeam.add((m as { user_id: string }).user_id);
  }

  const candidates = others.filter(
    (p: { user_id: string }) => !alreadyOnTeam.has(p.user_id)
  );
  if (candidates.length === 0) return { recommendations: [], needsTeam: true };

  // Fetch candidate names
  const { data: candidateUsers } = await supabase
    .from("users")
    .select("id, name")
    .in("id", candidates.map((c: { user_id: string }) => c.user_id));

  const nameMap = new Map(
    (candidateUsers ?? []).map((u: { id: string; name: string }) => [u.id, u.name])
  );

  // Build prompt
  const myDesc = [
    `Name: ${myUser?.name ?? "Me"}`,
    myProfile?.occupation ? `Occupation: ${myProfile.occupation}` : null,
    myProfile?.is_technical !== null && myProfile?.is_technical !== undefined
      ? `Background: ${myProfile.is_technical ? "Technical" : "Non-technical"}`
      : null,
    myProfile?.unique_skill ? `Unique skill: ${myProfile.unique_skill}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const candidateLines = candidates.map((c: {
    user_id: string;
    occupation: string | null;
    is_technical: boolean | null;
    unique_skill: string | null;
  }) => {
    const name = nameMap.get(c.user_id) ?? "Unknown";
    return [
      `ID: ${c.user_id}`,
      `Name: ${name}`,
      c.occupation ? `Occupation: ${c.occupation}` : null,
      c.is_technical !== null
        ? `Background: ${c.is_technical ? "Technical" : "Non-technical"}`
        : null,
      c.unique_skill ? `Unique skill: ${c.unique_skill}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  });

  const prompt = `You are a hackathon team matchmaker. An attendee needs help finding teammates.

Current user: ${myDesc}

Other attendees also looking for a team:
${candidateLines.join("\n")}

Return ONLY valid JSON — an array of up to 3 objects (best matches first):
[{"user_id":"...","reason":"One sentence why they'd complement this person (max 100 chars)"}]

Mix technical and non-technical backgrounds when possible. Reasons should be specific to their listed skill or occupation. Return only the JSON array.`;

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
    if (!jsonMatch) return { recommendations: [], needsTeam: true, error: "Unexpected LLM format" };

    const ranked = JSON.parse(jsonMatch[0]) as { user_id: string; reason: string }[];
    const profileMap = new Map(
      candidates.map((c: {
        user_id: string;
        occupation: string | null;
        is_technical: boolean | null;
        unique_skill: string | null;
        linkedin_url: string | null;
      }) => [c.user_id, c])
    );

    const recommendations: TeamRecommendation[] = ranked
      .slice(0, 3)
      .filter((r) => profileMap.has(r.user_id))
      .map((r) => {
        const profile = profileMap.get(r.user_id)!;
        return {
          userId: r.user_id,
          name: nameMap.get(r.user_id) ?? "Unknown",
          occupation: profile.occupation,
          is_technical: profile.is_technical,
          unique_skill: profile.unique_skill,
          linkedin_url: profile.linkedin_url,
          reason: r.reason,
        };
      });

    return { recommendations, needsTeam: true };
  } catch (e) {
    console.error("[getTeamRecommendations] error:", e);
    return { recommendations: [], needsTeam: true, error: "Failed to generate recommendations" };
  }
}
