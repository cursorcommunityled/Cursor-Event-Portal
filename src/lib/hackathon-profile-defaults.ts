import type { HackathonProfile } from "@/types";

export function preferredLinkedInUrl(
  hackathonLinkedIn?: string | null,
  intakeLinkedIn?: string | null,
  userLinkedIn?: string | null
) {
  return hackathonLinkedIn || intakeLinkedIn || userLinkedIn || null;
}

export function withDefaultHackathonLinkedIn(
  profile: HackathonProfile | null,
  fallbackLinkedIn: string | null | undefined,
  userId: string,
  eventId: string
): HackathonProfile | null {
  const linkedinUrl = preferredLinkedInUrl(profile?.linkedin_url, fallbackLinkedIn);
  if (!profile && !linkedinUrl) return null;

  return {
    user_id: userId,
    event_id: eventId,
    occupation: null,
    is_technical: null,
    unique_skill: null,
    needs_team: false,
    accessibility: null,
    profile_bio: null,
    project_interests: null,
    collaboration_style: null,
    looking_for_teammates: null,
    ...profile,
    linkedin_url: linkedinUrl,
  };
}
