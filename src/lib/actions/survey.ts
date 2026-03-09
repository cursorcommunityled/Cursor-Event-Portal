"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import { fanOutNotification } from "@/lib/notifications";

function getAdminSurveysPath(eventSlug: string, adminCode?: string) {
  return adminCode ? `/admin/${eventSlug}/${adminCode}/surveys` : `/admin/${eventSlug}/surveys`;
}

async function validateAdminAccess(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  adminCode?: string
) {
  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .single();

    if (event && event.admin_code === adminCode) {
      return { valid: true as const };
    }

    return { valid: false as const, error: "Not authorized" };
  }

  const session = await getSession();
  if (!session) {
    return { valid: false as const, error: "Not authenticated" };
  }

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { valid: false as const, error: "Not authorized" };
  }

  return { valid: true as const, userId: session.userId };
}

export async function submitSurveyResponse(
  surveyId: string,
  eventSlug: string,
  responses: Record<string, unknown>
) {
  const session = await getSession();

  const supabase = await createServiceClient();

  const { error } = await supabase.from("survey_responses").insert({
    survey_id: surveyId,
    user_id: session?.userId || null,
    responses,
  });

  if (error) {
    return { error: "Failed to submit survey" };
  }

  revalidatePath(`/${eventSlug}/feedback`);
  return { success: true };
}

export async function createSurvey(
  eventId: string,
  eventSlug: string,
  title: string,
  schema: { fields: Array<{ id: string; type: string; label: string; required: boolean; options?: string[] }> },
  adminCode?: string
) {
  const supabase = await createServiceClient();

  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { data, error } = await supabase
    .from("surveys")
    .insert({
      event_id: eventId,
      title,
      schema,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create survey" };
  }

  revalidatePath(getAdminSurveysPath(eventSlug, adminCode));
  return { success: true, surveyId: data.id };
}

export async function publishSurvey(surveyId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  // Unpublish any other published surveys for this event
  const { data: survey } = await supabase
    .from("surveys")
    .select("event_id")
    .eq("id", surveyId)
    .single();

  if (!survey) {
    return { error: "Survey not found" };
  }

  const auth = await validateAdminAccess(supabase, survey.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  if (survey) {
    await supabase
      .from("surveys")
      .update({ published_at: null })
      .eq("event_id", survey.event_id)
      .neq("id", surveyId);
  }

  const { error } = await supabase
    .from("surveys")
    .update({ published_at: new Date().toISOString() })
    .eq("id", surveyId);

  if (error) {
    return { error: "Failed to publish survey" };
  }

  revalidatePath(getAdminSurveysPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/feedback`);

  // Fan-out survey-live notification
  const { data: surveyData } = await supabase
    .from("surveys")
    .select("title, event_id")
    .eq("id", surveyId)
    .single();

  if (surveyData) {
    fanOutNotification(
      surveyData.event_id,
      "survey_live",
      "Survey Now Live",
      `"${surveyData.title}" is open — share your feedback!`,
      `/${eventSlug}/feedback`
    ).catch(() => {});
  }

  return { success: true };
}

export async function unpublishSurvey(surveyId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  const { data: survey } = await supabase
    .from("surveys")
    .select("event_id")
    .eq("id", surveyId)
    .single();

  if (!survey) {
    return { error: "Survey not found" };
  }

  const auth = await validateAdminAccess(supabase, survey.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("surveys")
    .update({ published_at: null })
    .eq("id", surveyId);

  if (error) {
    return { error: "Failed to unpublish survey" };
  }

  revalidatePath(getAdminSurveysPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/feedback`);
  return { success: true };
}

export async function deleteSurvey(surveyId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  const { data: survey } = await supabase
    .from("surveys")
    .select("event_id")
    .eq("id", surveyId)
    .single();

  if (!survey) {
    return { error: "Survey not found" };
  }

  const auth = await validateAdminAccess(supabase, survey.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("surveys")
    .delete()
    .eq("id", surveyId);

  if (error) {
    return { error: "Failed to delete survey" };
  }

  revalidatePath(getAdminSurveysPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/feedback`);
  return { success: true };
}

export async function createDefaultSurvey(eventId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  // Check if a survey already exists
  const { data: existing } = await supabase
    .from("surveys")
    .select("id")
    .eq("event_id", eventId)
    .limit(1)
    .single();

  if (existing) {
    return { error: "A survey already exists for this event" };
  }

  // Create default survey with common feedback questions
  const defaultSchema = {
    fields: [
      {
        id: "overall",
        type: "rating",
        label: "Overall, how would you rate this event?",
        required: true,
      },
      {
        id: "content",
        type: "rating",
        label: "How would you rate the content quality?",
        required: true,
      },
      {
        id: "speakers",
        type: "rating",
        label: "How would you rate the speakers/presentations?",
        required: true,
      },
      {
        id: "venue",
        type: "rating",
        label: "How would you rate the venue?",
        required: false,
      },
      {
        id: "feedback",
        type: "textarea",
        label: "Any additional feedback or suggestions?",
        required: false,
      },
    ],
  };

  const { data, error } = await supabase
    .from("surveys")
    .insert({
      event_id: eventId,
      title: "Event Feedback Survey",
      schema: defaultSchema,
      published_at: new Date().toISOString(), // Auto-publish the default survey
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create default survey" };
  }

  revalidatePath(getAdminSurveysPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/feedback`);
  return { success: true, surveyId: data.id };
}

export async function toggleSurveyPopup(eventId: string, eventSlug: string, visible: boolean, adminCode?: string) {
  const supabase = await createServiceClient();

  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("events")
    .update({ survey_popup_visible: visible })
    .eq("id", eventId);

  if (error) {
    return { error: "Failed to update survey popup visibility" };
  }

  revalidatePath(getAdminSurveysPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}`);
  revalidatePath(`/${eventSlug}/agenda`);
  return { success: true };
}

export async function exportSurveyResponses(surveyId: string, adminCode?: string) {
  const supabase = await createServiceClient();

  const { data: survey } = await supabase
    .from("surveys")
    .select("event_id")
    .eq("id", surveyId)
    .single();

  if (!survey) {
    return { error: "Survey not found" };
  }

  const auth = await validateAdminAccess(supabase, survey.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { data: responses, error } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("survey_id", surveyId);

  if (error) {
    return { error: "Failed to export responses" };
  }

  return { success: true, responses };
}
