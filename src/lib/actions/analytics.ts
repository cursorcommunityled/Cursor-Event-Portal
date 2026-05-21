"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";

// ============================================================================
// PAGE VIEW TRACKING
// ============================================================================

export type PageType = 
  | 'landing' 
  | 'registration' 
  | 'intake' 
  | 'agenda' 
  | 'qa' 
  | 'polls' 
  | 'slides' 
  | 'resources' 
  | 'feedback' 
  | 'display' 
  | 'admin' 
  | 'staff';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export async function recordPageView(
  eventId: string,
  pagePath: string,
  pageType: PageType,
  options?: {
    referrer?: string;
    userAgent?: string;
    deviceType?: DeviceType;
    sessionId?: string;
  }
) {
  try {
    const session = await getSession();
    const supabase = await createServiceClient();

    await supabase.from("page_views").insert({
      event_id: eventId,
      user_id: session?.userId || null,
      session_id: options?.sessionId || null,
      page_path: pagePath,
      page_type: pageType,
      referrer: options?.referrer || null,
      user_agent: options?.userAgent || null,
      device_type: options?.deviceType || null,
    });

    return { success: true };
  } catch (error) {
    console.error("[recordPageView] Error:", error);
    return { error: "Failed to record page view" };
  }
}

// ============================================================================
// FEATURE INTERACTION TRACKING
// ============================================================================

export type FeatureType =
  | 'question_viewed'
  | 'question_created'
  | 'question_upvoted'
  | 'poll_viewed'
  | 'poll_voted'
  | 'slide_viewed'
  | 'slide_deck_opened'
  | 'survey_started'
  | 'survey_completed'
  | 'intake_started'
  | 'intake_completed'
  | 'intake_skipped'
  | 'check_in_completed'
  | 'table_assignment_viewed'
  | 'announcement_seen'
  | 'banner_dismissed'
  | 'resource_accessed';

export async function recordFeatureInteraction(
  eventId: string,
  featureType: FeatureType,
  targetId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Not authenticated" };
    }

    const supabase = await createServiceClient();

    await supabase.from("feature_interactions").insert({
      event_id: eventId,
      user_id: session.userId,
      feature_type: featureType,
      target_id: targetId || null,
      metadata: metadata || null,
    });

    return { success: true };
  } catch (error) {
    console.error("[recordFeatureInteraction] Error:", error);
    return { error: "Failed to record interaction" };
  }
}

// ============================================================================
// SEEN ITEMS TRACKING (REPLACES localStorage)
// ============================================================================

export type SeenItemType = 'question' | 'poll' | 'announcement' | 'table_assignment' | 'slide';

export async function markItemAsSeen(
  eventId: string,
  itemType: SeenItemType,
  itemId: string
) {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Not authenticated" };
    }

    const supabase = await createServiceClient();

    await supabase.from("user_seen_items").upsert({
      user_id: session.userId,
      event_id: eventId,
      item_type: itemType,
      item_id: itemId,
    }, {
      onConflict: 'user_id,item_type,item_id',
      ignoreDuplicates: true,
    });

    return { success: true };
  } catch (error) {
    console.error("[markItemAsSeen] Error:", error);
    return { error: "Failed to mark item as seen" };
  }
}

export async function markMultipleItemsAsSeen(
  eventId: string,
  itemType: SeenItemType,
  itemIds: string[]
) {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Not authenticated" };
    }

    if (itemIds.length === 0) {
      return { success: true };
    }

    const supabase = await createServiceClient();

    const records = itemIds.map(itemId => ({
      user_id: session.userId,
      event_id: eventId,
      item_type: itemType,
      item_id: itemId,
    }));

    await supabase.from("user_seen_items").upsert(records, {
      onConflict: 'user_id,item_type,item_id',
      ignoreDuplicates: true,
    });

    return { success: true };
  } catch (error) {
    console.error("[markMultipleItemsAsSeen] Error:", error);
    return { error: "Failed to mark items as seen" };
  }
}

export async function hasUserSeenItem(
  userId: string,
  itemType: SeenItemType,
  itemId: string
): Promise<boolean> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("user_seen_items")
      .select("id")
      .eq("user_id", userId)
      .eq("item_type", itemType)
      .eq("item_id", itemId)
      .maybeSingle();

    if (error) {
      console.error("[hasUserSeenItem] Error:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("[hasUserSeenItem] Exception:", error);
    return false;
  }
}

export async function getSeenItemIds(
  userId: string,
  eventId: string,
  itemType: SeenItemType
): Promise<string[]> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("user_seen_items")
      .select("item_id")
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .eq("item_type", itemType);

    if (error) {
      console.error("[getSeenItemIds] Error:", error);
      return [];
    }

    return (data || []).map(row => row.item_id);
  } catch (error) {
    console.error("[getSeenItemIds] Exception:", error);
    return [];
  }
}

export async function getUnseenQuestionIds(
  eventId: string,
  userId: string
): Promise<string[]> {
  try {
    const supabase = await createServiceClient();

    // Get all open questions
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id")
      .eq("event_id", eventId)
      .eq("status", "open");

    if (qError || !questions) {
      return [];
    }

    // Get seen question IDs
    const seenIds = await getSeenItemIds(userId, eventId, 'question');
    const seenSet = new Set(seenIds);

    // Return unseen
    return questions.filter(q => !seenSet.has(q.id)).map(q => q.id);
  } catch (error) {
    console.error("[getUnseenQuestionIds] Exception:", error);
    return [];
  }
}

export async function getUnseenPollIds(
  eventId: string,
  userId: string
): Promise<string[]> {
  try {
    const supabase = await createServiceClient();

    // Get all active polls
    const { data: polls, error: pError } = await supabase
      .from("polls")
      .select("id")
      .eq("event_id", eventId)
      .eq("is_active", true);

    if (pError || !polls) {
      return [];
    }

    // Get seen poll IDs
    const seenIds = await getSeenItemIds(userId, eventId, 'poll');
    const seenSet = new Set(seenIds);

    // Return unseen
    return polls.filter(p => !seenSet.has(p.id)).map(p => p.id);
  } catch (error) {
    console.error("[getUnseenPollIds] Exception:", error);
    return [];
  }
}

// ============================================================================
// UI DISMISSALS (REPLACES localStorage for banner dismissals)
// ============================================================================

export type DismissalType = 
  | 'intake_banner' 
  | 'survey_prompt' 
  | 'poll_notification' 
  | 'table_assignment_animation' 
  | 'welcome_modal';

export async function recordDismissal(
  eventId: string,
  dismissalType: DismissalType
) {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Not authenticated" };
    }

    const supabase = await createServiceClient();

    await supabase.from("ui_dismissals").upsert({
      user_id: session.userId,
      event_id: eventId,
      dismissal_type: dismissalType,
    }, {
      onConflict: 'user_id,event_id,dismissal_type',
      ignoreDuplicates: true,
    });

    return { success: true };
  } catch (error) {
    console.error("[recordDismissal] Error:", error);
    return { error: "Failed to record dismissal" };
  }
}

export async function hasDismissed(
  userId: string,
  eventId: string,
  dismissalType: DismissalType
): Promise<boolean> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("ui_dismissals")
      .select("id")
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .eq("dismissal_type", dismissalType)
      .maybeSingle();

    if (error) {
      console.error("[hasDismissed] Error:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("[hasDismissed] Exception:", error);
    return false;
  }
}

// ============================================================================
// QUESTION & POLL VIEW TRACKING
// ============================================================================

export async function recordQuestionView(
  questionId: string,
  sessionId?: string
) {
  try {
    const session = await getSession();
    const supabase = await createServiceClient();

    await supabase.from("question_views").insert({
      question_id: questionId,
      user_id: session?.userId || null,
      session_id: sessionId || null,
    });

    return { success: true };
  } catch (error) {
    console.error("[recordQuestionView] Error:", error);
    return { error: "Failed to record question view" };
  }
}

export async function recordPollView(
  pollId: string,
  sessionId?: string
) {
  try {
    const session = await getSession();
    const supabase = await createServiceClient();

    await supabase.from("poll_views").insert({
      poll_id: pollId,
      user_id: session?.userId || null,
      session_id: sessionId || null,
    });

    return { success: true };
  } catch (error) {
    console.error("[recordPollView] Error:", error);
    return { error: "Failed to record poll view" };
  }
}

export async function recordSlideView(
  eventId: string,
  options: {
    slideId?: string;
    slideDeckId?: string;
    pageNumber?: number;
    durationMs?: number;
  }
) {
  try {
    const session = await getSession();
    const supabase = await createServiceClient();

    await supabase.from("slide_views").insert({
      event_id: eventId,
      user_id: session?.userId || null,
      slide_id: options.slideId || null,
      slide_deck_id: options.slideDeckId || null,
      page_number: options.pageNumber || null,
      duration_ms: options.durationMs || null,
    });

    return { success: true };
  } catch (error) {
    console.error("[recordSlideView] Error:", error);
    return { error: "Failed to record slide view" };
  }
}

// ============================================================================
// ADMIN AUDIT LOGGING
// ============================================================================

export type AdminActionType =
  | 'event_created'
  | 'event_updated'
  | 'event_status_changed'
  | 'registration_added'
  | 'registration_removed'
  | 'check_in_manual'
  | 'question_status_changed'
  | 'question_deleted'
  | 'answer_created'
  | 'poll_created'
  | 'poll_updated'
  | 'poll_deleted'
  | 'poll_activated'
  | 'announcement_created'
  | 'announcement_deleted'
  | 'survey_created'
  | 'survey_published'
  | 'survey_unpublished'
  | 'group_approved'
  | 'group_rejected'
  | 'group_modified'
  | 'slide_uploaded'
  | 'slide_deleted'
  | 'slide_deck_uploaded'
  | 'lockout_enabled'
  | 'lockout_disabled'
  | 'data_exported'
  | 'data_deleted';

export async function logAdminAction(
  eventId: string,
  actionType: AdminActionType,
  options?: {
    targetType?: string;
    targetId?: string;
    previousValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const session = await getSession();
    if (!session) {
      console.warn("[logAdminAction] No session - skipping audit log");
      return { success: false };
    }

    const supabase = await createServiceClient();

    await supabase.from("admin_audit_log").insert({
      event_id: eventId,
      admin_user_id: session.userId,
      action_type: actionType,
      target_type: options?.targetType || null,
      target_id: options?.targetId || null,
      previous_value: options?.previousValue || null,
      new_value: options?.newValue || null,
      metadata: options?.metadata || null,
    });

    return { success: true };
  } catch (error) {
    console.error("[logAdminAction] Error:", error);
    return { error: "Failed to log admin action" };
  }
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

export async function logError(
  options: {
    eventId?: string;
    errorType: string;
    errorMessage: string;
    errorStack?: string;
    pagePath?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    sessionId?: string;
  }
) {
  try {
    const session = await getSession();
    const supabase = await createServiceClient();

    await supabase.from("error_logs").insert({
      event_id: options.eventId || null,
      user_id: session?.userId || null,
      session_id: options.sessionId || null,
      error_type: options.errorType,
      error_message: options.errorMessage,
      error_stack: options.errorStack || null,
      page_path: options.pagePath || null,
      user_agent: options.userAgent || null,
      metadata: options.metadata || null,
    });

    return { success: true };
  } catch (error) {
    console.error("[logError] Error:", error);
    return { error: "Failed to log error" };
  }
}

// ============================================================================
// UX EVENT TRACKING
// ============================================================================

export type UxEventType = "action" | "navigation" | "search" | "system";

export async function recordUxEvent(
  eventId: string,
  options: {
    eventType: UxEventType;
    action?: string;
    element?: string;
    label?: string | null;
    module?: string | null;
    pagePath?: string;
    metadata?: Record<string, unknown>;
    sessionId?: string;
    userAgent?: string;
  }
) {
  try {
    const session = await getSession();
    const supabase = await createServiceClient();

    await supabase.from("ux_events").insert({
      event_id: eventId,
      user_id: session?.userId || null,
      session_id: options.sessionId || null,
      event_type: options.eventType,
      action: options.action || null,
      element: options.element || null,
      label: options.label || null,
      module: options.module || null,
      page_path: options.pagePath || null,
      metadata: options.metadata || null,
      user_agent: options.userAgent || null,
    });

    return { success: true };
  } catch (error) {
    console.error("[recordUxEvent] Error:", error);
    return { error: "Failed to record UX event" };
  }
}

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

export async function getPageViewStats(eventId: string) {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("page_views")
      .select("page_type, created_at")
      .eq("event_id", eventId);

    if (error) {
      console.error("[getPageViewStats] Error:", error);
      return null;
    }

    // Group by page type
    const byType: Record<string, number> = {};
    (data || []).forEach(view => {
      byType[view.page_type] = (byType[view.page_type] || 0) + 1;
    });

    return {
      total: data?.length || 0,
      byType,
    };
  } catch (error) {
    console.error("[getPageViewStats] Exception:", error);
    return null;
  }
}

export async function getFeatureEngagementStats(eventId: string) {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("feature_interactions")
      .select("feature_type, user_id")
      .eq("event_id", eventId);

    if (error) {
      console.error("[getFeatureEngagementStats] Error:", error);
      return null;
    }

    // Group by feature type
    const byFeature: Record<string, { total: number; uniqueUsers: Set<string> }> = {};
    
    (data || []).forEach(interaction => {
      if (!byFeature[interaction.feature_type]) {
        byFeature[interaction.feature_type] = { total: 0, uniqueUsers: new Set() };
      }
      byFeature[interaction.feature_type].total++;
      byFeature[interaction.feature_type].uniqueUsers.add(interaction.user_id);
    });

    // Convert to plain object
    const result: Record<string, { total: number; uniqueUsers: number }> = {};
    Object.entries(byFeature).forEach(([key, value]) => {
      result[key] = {
        total: value.total,
        uniqueUsers: value.uniqueUsers.size,
      };
    });

    return result;
  } catch (error) {
    console.error("[getFeatureEngagementStats] Exception:", error);
    return null;
  }
}

export async function getAdminAuditLog(eventId: string, limit = 50) {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("admin_audit_log")
      .select(`
        *,
        admin_user:users!admin_audit_log_admin_user_id_fkey(id, name, email)
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getAdminAuditLog] Error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("[getAdminAuditLog] Exception:", error);
    return [];
  }
}
