"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";

// ============================================================================
// ATTENDEE DATA EXPORT
// ============================================================================

export async function getDetailedAttendeeData(eventId: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Check if user is admin
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { error: "Not authorized" };
  }

  // Get all registrations with user data
  const { data: registrations } = await supabase
    .from("registrations")
    .select("*, user:users(id, name, email, role, role_category, founder_stage, years_experience, degree_type, linkedin, github, website, intent, followup_consent, cursor_experience)")
    .eq("event_id", eventId);

  if (!registrations) {
    return { error: "Failed to fetch registrations" };
  }

  const userIds = registrations
    .map((r) => {
      const user = Array.isArray(r.user) ? r.user[0] : r.user;
      return user?.id;
    })
    .filter(Boolean) as string[];

  // Fetch all intakes
  const { data: intakes } = await supabase
    .from("attendee_intakes")
    .select("*")
    .eq("event_id", eventId)
    .in("user_id", userIds);

  // Fetch all poll votes with poll info
  const { data: pollVotes } = await supabase
    .from("poll_votes")
    .select(`
      *,
      poll:polls(
        id,
        question,
        options,
        event_id
      )
    `)
    .in("user_id", userIds);

  // Filter poll votes to this event
  const eventPollVotes = (pollVotes || []).filter(
    (vote) => vote.poll && (vote.poll as any).event_id === eventId
  );

  // Fetch all questions
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", eventId)
    .in("user_id", userIds);

  // Fetch all answers
  const { data: answers } = await supabase
    .from("answers")
    .select(`
      *,
      question:questions(
        id,
        content,
        event_id
      )
    `)
    .in("user_id", userIds);

  // Filter answers to this event
  const eventAnswers = (answers || []).filter(
    (answer) => answer.question && (answer.question as any).event_id === eventId
  );

  // Fetch all upvotes
  const { data: upvotes } = await supabase
    .from("question_upvotes")
    .select(`
      *,
      question:questions(
        id,
        content,
        event_id
      )
    `)
    .in("user_id", userIds);

  // Filter upvotes to this event
  const eventUpvotes = (upvotes || []).filter(
    (upvote) => upvote.question && (upvote.question as any).event_id === eventId
  );

  // Build detailed data for each attendee
  const detailedData = registrations.map((reg) => {
    const user = Array.isArray(reg.user) ? reg.user[0] : reg.user;
    const userId = user?.id;
    
    const intake = intakes?.find((i) => i.user_id === userId);
    const userPollVotes = eventPollVotes.filter((v) => v.user_id === userId);
    const userQuestions = questions?.filter((q) => q.user_id === userId) || [];
    const userAnswers = eventAnswers.filter((a) => a.user_id === userId);
    const userUpvotes = eventUpvotes.filter((u) => u.user_id === userId);

    return {
      name: user?.name || "",
      email: user?.email || "",
      checked_in: reg.checked_in_at ? "Yes" : "No",
      checked_in_at: reg.checked_in_at || "",
      registered_at: reg.created_at,
      // Intake data
      goals: intake?.goals?.join("; ") || "",
      goals_other: intake?.goals_other || "",
      offers: intake?.offers?.join("; ") || "",
      offers_other: intake?.offers_other || "",
      role_category: intake?.role_category || user?.role_category || "",
      founder_stage: intake?.founder_stage || user?.founder_stage || "",
      years_experience:
        intake?.years_experience ?? user?.years_experience ?? "",
      degree_type: intake?.degree_type || user?.degree_type || "",
      linkedin: intake?.linkedin || user?.linkedin || "",
      github: intake?.github || user?.github || "",
      website: intake?.website || user?.website || "",
      intent: intake?.intent || user?.intent || "",
      commitment:
        typeof intake?.followup_consent === "boolean"
          ? intake.followup_consent
            ? "Yes"
            : "No"
          : typeof user?.followup_consent === "boolean"
            ? user.followup_consent
              ? "Yes"
              : "No"
            : "",
      cursor_experience:
        intake?.cursor_experience || user?.cursor_experience || "",
      intake_skipped: intake?.skipped ? "Yes" : "No",
      intake_completed_at: intake?.created_at || "",
      // Poll votes
      poll_votes_count: userPollVotes.length,
      poll_votes: userPollVotes.map((v) => {
        const poll = Array.isArray(v.poll) ? v.poll[0] : v.poll;
        const options = (poll as any)?.options || [];
        return `${(poll as any)?.question || ""}: ${options[v.option_index] || ""}`;
      }).join(" | "),
      // Q&A
      questions_asked: userQuestions.length,
      questions_content: userQuestions.map((q) => q.content).join(" | "),
      answers_provided: userAnswers.length,
      answers_content: userAnswers.map((a) => {
        const q = Array.isArray(a.question) ? a.question[0] : a.question;
        return `Q: ${(q as any)?.content || ""} | A: ${a.content}`;
      }).join(" | "),
      upvotes_count: userUpvotes.length,
    };
  });

  return { success: true, data: detailedData };
}

// ============================================================================
// ALL-EVENTS EXPORTS
// ============================================================================

async function checkAdminAuth() {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" as const };
  const supabase = await createServiceClient();
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();
  if (!user || user.role !== "admin") return { error: "Not authorized" as const };
  return { supabase, session };
}

export async function getAllEventsRegistrations() {
  const auth = await checkAdminAuth();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { data: registrations } = await supabase
    .from("registrations")
    .select("*, user:users(name, email), event:events(slug, title)")
    .order("created_at", { ascending: false });

  const data = (registrations || []).map((reg) => {
    const user = Array.isArray(reg.user) ? reg.user[0] : reg.user;
    const event = Array.isArray(reg.event) ? reg.event[0] : reg.event;
    return {
      event_slug: (event as any)?.slug || "",
      event_title: (event as any)?.title || "",
      name: (user as any)?.name || "",
      email: (user as any)?.email || "",
      checked_in: reg.checked_in_at ? "Yes" : "No",
      checked_in_at: reg.checked_in_at || "",
      registered_at: reg.created_at,
      source: reg.source,
    };
  });

  return { success: true, data };
}

export async function getAllEventsQuestions() {
  const auth = await checkAdminAuth();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { data: questions } = await supabase
    .from("questions")
    .select("*, user:users(name), event:events(slug, title)")
    .order("created_at", { ascending: false });

  const data = (questions || []).map((q) => {
    const event = Array.isArray(q.event) ? q.event[0] : q.event;
    return {
      event_slug: (event as any)?.slug || "",
      event_title: (event as any)?.title || "",
      content: q.content,
      author: (q.user as any)?.name || "Anonymous",
      upvotes: q.upvotes,
      status: q.status,
      tags: (q.tags || []).join("; "),
      created_at: q.created_at,
      answer_count: (q as any).answers?.length || 0,
    };
  });

  return { success: true, data };
}

export async function getAllEventsSurveyResponses() {
  const auth = await checkAdminAuth();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { data: responses } = await supabase
    .from("survey_responses")
    .select("*, survey:surveys(title, event:events(slug, title))")
    .order("created_at", { ascending: false });

  const data = (responses || []).map((r) => {
    const survey = Array.isArray(r.survey) ? r.survey[0] : r.survey;
    const event = survey?.event
      ? Array.isArray(survey.event)
        ? survey.event[0]
        : survey.event
      : null;
    return {
      event_slug: (event as any)?.slug || "",
      event_title: (event as any)?.title || "",
      survey_title: (survey as any)?.title || "",
      user_id: r.user_id || "anonymous",
      responses: JSON.stringify(r.responses),
      created_at: r.created_at,
    };
  });

  return { success: true, data };
}

export async function getAllEventsDetailedAttendeeData() {
  const auth = await checkAdminAuth();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { data: registrations } = await supabase
    .from("registrations")
    .select("*, user:users(id, name, email, role, role_category, founder_stage, years_experience, degree_type, linkedin, github, website, intent, followup_consent, cursor_experience), event:events(id, slug, title)")
    .order("created_at", { ascending: false });

  if (!registrations) return { error: "Failed to fetch registrations" };

  const userIds = registrations
    .map((r) => {
      const user = Array.isArray(r.user) ? r.user[0] : r.user;
      return (user as any)?.id;
    })
    .filter(Boolean) as string[];

  const [intakesRes, pollVotesRes, questionsRes, answersRes, upvotesRes] = await Promise.all([
    supabase.from("attendee_intakes").select("*").in("user_id", userIds),
    supabase.from("poll_votes").select("*, poll:polls(id, question, options, event_id)").in("user_id", userIds),
    supabase.from("questions").select("*, event:events(slug, title)").in("user_id", userIds),
    supabase.from("answers").select("*, question:questions(id, content, event_id)").in("user_id", userIds),
    supabase.from("question_upvotes").select("*, question:questions(id, content, event_id)").in("user_id", userIds),
  ]);

  const intakes = intakesRes.data || [];
  const pollVotes = pollVotesRes.data || [];
  const questions = questionsRes.data || [];
  const answers = answersRes.data || [];
  const upvotes = upvotesRes.data || [];

  const detailedData = registrations.map((reg) => {
    const user = Array.isArray(reg.user) ? reg.user[0] : reg.user;
    const eventRec = Array.isArray(reg.event) ? reg.event[0] : reg.event;
    const userId = (user as any)?.id;
    const eventId = (eventRec as any)?.id;

    const intake = intakes.find((i) => i.user_id === userId && i.event_id === eventId);
    const userPollVotes = pollVotes.filter(
      (v) => v.user_id === userId && (v.poll as any)?.event_id === eventId
    );
    const userQuestions = questions.filter((q) => q.user_id === userId && q.event_id === eventId);
    const userAnswers = answers.filter(
      (a) => a.user_id === userId && (a.question as any)?.event_id === eventId
    );
    const userUpvotes = upvotes.filter(
      (u) => u.user_id === userId && (u.question as any)?.event_id === eventId
    );

    return {
      event_slug: (eventRec as any)?.slug || "",
      event_title: (eventRec as any)?.title || "",
      name: (user as any)?.name || "",
      email: (user as any)?.email || "",
      checked_in: reg.checked_in_at ? "Yes" : "No",
      checked_in_at: reg.checked_in_at || "",
      registered_at: reg.created_at,
      goals: intake?.goals?.join("; ") || "",
      goals_other: intake?.goals_other || "",
      offers: intake?.offers?.join("; ") || "",
      offers_other: intake?.offers_other || "",
      role_category: intake?.role_category || (user as any)?.role_category || "",
      founder_stage: intake?.founder_stage || (user as any)?.founder_stage || "",
      years_experience: intake?.years_experience ?? (user as any)?.years_experience ?? "",
      degree_type: intake?.degree_type || (user as any)?.degree_type || "",
      linkedin: intake?.linkedin || (user as any)?.linkedin || "",
      github: intake?.github || (user as any)?.github || "",
      website: intake?.website || (user as any)?.website || "",
      intent: intake?.intent || (user as any)?.intent || "",
      commitment:
        typeof intake?.followup_consent === "boolean"
          ? intake.followup_consent ? "Yes" : "No"
          : typeof (user as any)?.followup_consent === "boolean"
            ? (user as any).followup_consent ? "Yes" : "No"
            : "",
      cursor_experience: intake?.cursor_experience || (user as any)?.cursor_experience || "",
      intake_skipped: intake?.skipped ? "Yes" : "No",
      intake_completed_at: intake?.created_at || "",
      poll_votes_count: userPollVotes.length,
      poll_votes: userPollVotes.map((v) => {
        const poll = Array.isArray(v.poll) ? v.poll[0] : v.poll;
        const options = (poll as any)?.options || [];
        return `${(poll as any)?.question || ""}: ${options[v.option_index] || ""}`;
      }).join(" | "),
      questions_asked: userQuestions.length,
      questions_content: userQuestions.map((q) => q.content).join(" | "),
      answers_provided: userAnswers.length,
      answers_content: userAnswers.map((a) => {
        const q = Array.isArray(a.question) ? a.question[0] : a.question;
        return `Q: ${(q as any)?.content || ""} | A: ${a.content}`;
      }).join(" | "),
      upvotes_count: userUpvotes.length,
    };
  });

  return { success: true, data: detailedData };
}

// ============================================================================
// ANALYTICS DATA EXPORT
// ============================================================================

export async function getAnalyticsExport(eventId: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Check if user is admin
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { error: "Not authorized" };
  }

  // Fetch page views
  const { data: pageViews } = await supabase
    .from("page_views")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  // Fetch feature interactions
  const { data: featureInteractions } = await supabase
    .from("feature_interactions")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  // Fetch question views
  const { data: questionViews } = await supabase
    .from("question_views")
    .select(`
      *,
      question:questions(id, content, event_id)
    `)
    .order("viewed_at", { ascending: false });

  // Filter to this event's questions
  const eventQuestionViews = (questionViews || []).filter(
    (v) => v.question && (v.question as any).event_id === eventId
  );

  // Fetch poll views
  const { data: pollViews } = await supabase
    .from("poll_views")
    .select(`
      *,
      poll:polls(id, question, event_id)
    `)
    .order("viewed_at", { ascending: false });

  // Filter to this event's polls
  const eventPollViews = (pollViews || []).filter(
    (v) => v.poll && (v.poll as any).event_id === eventId
  );

  // Fetch slide views
  const { data: slideViews } = await supabase
    .from("slide_views")
    .select("*")
    .eq("event_id", eventId)
    .order("viewed_at", { ascending: false });

  // Fetch admin audit log
  const { data: auditLog } = await supabase
    .from("admin_audit_log")
    .select(`
      *,
      admin_user:users!admin_audit_log_admin_user_id_fkey(id, name, email)
    `)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  // Fetch error logs
  const { data: errorLogs } = await supabase
    .from("error_logs")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  // Fetch user seen items
  const { data: seenItems } = await supabase
    .from("user_seen_items")
    .select("*")
    .eq("event_id", eventId);

  // Fetch UI dismissals
  const { data: dismissals } = await supabase
    .from("ui_dismissals")
    .select("*")
    .eq("event_id", eventId);

  return {
    success: true,
    data: {
      pageViews: pageViews || [],
      featureInteractions: featureInteractions || [],
      questionViews: eventQuestionViews,
      pollViews: eventPollViews,
      slideViews: slideViews || [],
      auditLog: auditLog || [],
      errorLogs: errorLogs || [],
      seenItems: seenItems || [],
      dismissals: dismissals || [],
    },
  };
}

// ============================================================================
// ANALYTICS SUMMARY EXPORT (Aggregated metrics)
// ============================================================================

export async function getAnalyticsSummary(eventId: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Check if user is admin
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { error: "Not authorized" };
  }

  // Page views by type
  const { data: pageViews } = await supabase
    .from("page_views")
    .select("page_type, user_id")
    .eq("event_id", eventId);

  const pageViewsByType: Record<string, { total: number; uniqueUsers: number }> = {};
  const pageViewUsers: Record<string, Set<string>> = {};

  (pageViews || []).forEach((pv) => {
    if (!pageViewsByType[pv.page_type]) {
      pageViewsByType[pv.page_type] = { total: 0, uniqueUsers: 0 };
      pageViewUsers[pv.page_type] = new Set();
    }
    pageViewsByType[pv.page_type].total++;
    if (pv.user_id) {
      pageViewUsers[pv.page_type].add(pv.user_id);
    }
  });

  Object.keys(pageViewsByType).forEach((type) => {
    pageViewsByType[type].uniqueUsers = pageViewUsers[type].size;
  });

  // Feature interactions by type
  const { data: featureInteractions } = await supabase
    .from("feature_interactions")
    .select("feature_type, user_id")
    .eq("event_id", eventId);

  const featuresByType: Record<string, { total: number; uniqueUsers: number }> = {};
  const featureUsers: Record<string, Set<string>> = {};

  (featureInteractions || []).forEach((fi) => {
    if (!featuresByType[fi.feature_type]) {
      featuresByType[fi.feature_type] = { total: 0, uniqueUsers: 0 };
      featureUsers[fi.feature_type] = new Set();
    }
    featuresByType[fi.feature_type].total++;
    if (fi.user_id) {
      featureUsers[fi.feature_type].add(fi.user_id);
    }
  });

  Object.keys(featuresByType).forEach((type) => {
    featuresByType[type].uniqueUsers = featureUsers[type].size;
  });

  // Error summary
  const { data: errors } = await supabase
    .from("error_logs")
    .select("error_type")
    .eq("event_id", eventId);

  const errorsByType: Record<string, number> = {};
  (errors || []).forEach((e) => {
    errorsByType[e.error_type] = (errorsByType[e.error_type] || 0) + 1;
  });

  return {
    success: true,
    data: {
      totalPageViews: pageViews?.length || 0,
      pageViewsByType,
      totalFeatureInteractions: featureInteractions?.length || 0,
      featuresByType,
      totalErrors: errors?.length || 0,
      errorsByType,
    },
  };
}

// ============================================================================
// FULL EVENT EXPORT (Everything in one file)
// ============================================================================

export async function getFullEventExport(eventId: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Check if user is admin
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { error: "Not authorized" };
  }

  // Fetch event details
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  // Fetch all attendee data
  const attendeeResult = await getDetailedAttendeeData(eventId);
  const analyticsResult = await getAnalyticsExport(eventId);
  const summaryResult = await getAnalyticsSummary(eventId);

  // Fetch all questions
  const { data: questions } = await supabase
    .from("questions")
    .select("*, user:users(name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  // Fetch all polls with votes
  const { data: polls } = await supabase
    .from("polls")
    .select("*")
    .eq("event_id", eventId);

  const { data: pollVotes } = await supabase
    .from("poll_votes")
    .select("*, user:users(name, email)")
    .in("poll_id", (polls || []).map((p) => p.id));

  // Fetch survey responses
  const { data: surveys } = await supabase
    .from("surveys")
    .select("*")
    .eq("event_id", eventId);

  const { data: surveyResponses } = await supabase
    .from("survey_responses")
    .select("*, user:users(name, email)")
    .in("survey_id", (surveys || []).map((s) => s.id));

  // Fetch groups
  const { data: groups } = await supabase
    .from("suggested_groups")
    .select(`
      *,
      members:suggested_group_members(
        user:users(id, name, email)
      )
    `)
    .eq("event_id", eventId);

  return {
    success: true,
    data: {
      event,
      attendees: attendeeResult.success ? attendeeResult.data : [],
      analytics: analyticsResult.success ? analyticsResult.data : {},
      summary: summaryResult.success ? summaryResult.data : {},
      questions: questions || [],
      polls: polls || [],
      pollVotes: pollVotes || [],
      surveys: surveys || [],
      surveyResponses: surveyResponses || [],
      groups: groups || [],
      exportedAt: new Date().toISOString(),
    },
  };
}
