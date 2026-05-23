"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

async function validateAdminAccess(
  eventId: string,
  adminCode?: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  const supabase = await createServiceClient();

  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .single();

    if (event && event.admin_code === adminCode) {
      return { valid: true };
    }
  }

  const session = await getSession();
  if (!session) return { valid: false, error: "Not authenticated" };

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || !["staff", "admin"].includes(user.role)) {
    return { valid: false, error: "Not authorized" };
  }

  return { valid: true };
}

type MentorData = {
  name: string;
  title?: string;
  company?: string;
  bio?: string;
  photoUrl?: string;
  meetLink?: string;
  virtualCallInstructions?: string;
  mentorshipMode?: "virtual" | "in_person" | "hybrid";
  inPersonLocation?: string;
  inPersonSchedule?: string;
  displayOrder?: number;
  isMentor?: boolean;
  isJudge?: boolean;
};

function normalizeMentorshipMode(mode: MentorData["mentorshipMode"]) {
  return mode === "in_person" || mode === "hybrid" ? mode : "virtual";
}

export async function createMentor(
  eventId: string,
  eventSlug: string,
  adminCode: string,
  data: MentorData
) {
  const auth = await validateAdminAccess(eventId, adminCode);
  if (!auth.valid) return { error: auth.error };
  if (!data.name.trim()) return { error: "Name is required" };
  if (data.isMentor === false && data.isJudge !== true) {
    return { error: "Select at least one role" };
  }
  const mentorshipMode = normalizeMentorshipMode(data.mentorshipMode);

  const supabase = await createServiceClient();
  const { error } = await supabase.from("mentors").insert({
    event_id: eventId,
    name: data.name.trim(),
    title: data.title?.trim() || null,
    company: data.company?.trim() || null,
    bio: data.bio?.trim() || null,
    photo_url: data.photoUrl?.trim() || null,
    meet_link: data.meetLink?.trim() || null,
    virtual_call_instructions: data.virtualCallInstructions?.trim() || null,
    mentorship_mode: mentorshipMode,
    in_person_location: data.inPersonLocation?.trim() || null,
    in_person_schedule: data.inPersonSchedule?.trim() || null,
    display_order: data.displayOrder ?? 0,
    is_mentor: data.isMentor ?? true,
    is_judge: data.isJudge ?? false,
  });

  if (error) return { error: error.message || "Failed to create mentor" };

  revalidatePath(`/admin/${adminCode}/sessions`);
  revalidatePath(`/admin/${adminCode}/hackathon`);
  revalidatePath(`/${eventSlug}/sessions`);
  revalidatePath(`/${eventSlug}/hackathon/mentors`);
  revalidatePath(`/${eventSlug}/hackathon/judges`);
  return { success: true };
}

export async function updateMentor(
  eventId: string,
  eventSlug: string,
  adminCode: string,
  mentorId: string,
  data: MentorData
) {
  const auth = await validateAdminAccess(eventId, adminCode);
  if (!auth.valid) return { error: auth.error };
  if (!data.name.trim()) return { error: "Name is required" };
  if (data.isMentor === false && data.isJudge !== true) {
    return { error: "Select at least one role" };
  }
  const mentorshipMode = normalizeMentorshipMode(data.mentorshipMode);

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("mentors")
    .update({
      name: data.name.trim(),
      title: data.title?.trim() || null,
      company: data.company?.trim() || null,
      bio: data.bio?.trim() || null,
      photo_url: data.photoUrl?.trim() || null,
      meet_link: data.meetLink?.trim() || null,
      virtual_call_instructions: data.virtualCallInstructions?.trim() || null,
      mentorship_mode: mentorshipMode,
      in_person_location: data.inPersonLocation?.trim() || null,
      in_person_schedule: data.inPersonSchedule?.trim() || null,
      display_order: data.displayOrder ?? 0,
      is_mentor: data.isMentor ?? true,
      is_judge: data.isJudge ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", mentorId)
    .eq("event_id", eventId);

  if (error) return { error: error.message || "Failed to update mentor" };

  revalidatePath(`/admin/${adminCode}/sessions`);
  revalidatePath(`/admin/${adminCode}/hackathon`);
  revalidatePath(`/${eventSlug}/sessions`);
  revalidatePath(`/${eventSlug}/sessions/mentors/${mentorId}`);
  revalidatePath(`/${eventSlug}/hackathon/mentors`);
  revalidatePath(`/${eventSlug}/hackathon/mentors/${mentorId}`);
  revalidatePath(`/${eventSlug}/hackathon/judges`);
  return { success: true };
}

export async function deleteMentor(
  eventId: string,
  eventSlug: string,
  adminCode: string,
  mentorId: string
) {
  const auth = await validateAdminAccess(eventId, adminCode);
  if (!auth.valid) return { error: auth.error };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("mentors")
    .delete()
    .eq("id", mentorId)
    .eq("event_id", eventId);

  if (error) return { error: error.message || "Failed to delete mentor" };

  revalidatePath(`/admin/${adminCode}/sessions`);
  revalidatePath(`/admin/${adminCode}/hackathon`);
  revalidatePath(`/${eventSlug}/sessions`);
  revalidatePath(`/${eventSlug}/hackathon/mentors`);
  revalidatePath(`/${eventSlug}/hackathon/judges`);
  return { success: true };
}
