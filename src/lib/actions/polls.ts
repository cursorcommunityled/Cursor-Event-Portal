"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import { fanOutNotification } from "@/lib/notifications";

function getAdminPollsPath(eventSlug: string, adminCode?: string) {
  return adminCode ? `/admin/${eventSlug}/${adminCode}/polls` : `/admin/${eventSlug}/polls`;
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

    return { valid: false as const, error: "Not authorized. Admin access required." };
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
    return { valid: false as const, error: "Not authorized. Admin access required." };
  }

  return { valid: true as const, userId: session.userId };
}

export async function votePoll(
  pollId: string,
  optionIndex: number,
  eventSlug: string
) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // Check if poll exists and is active
  const { data: poll } = await supabase
    .from("polls")
    .select("*")
    .eq("id", pollId)
    .single();

  if (!poll) {
    return { error: "Poll not found" };
  }

  if (!poll.is_active) {
    return { error: "Poll is no longer active" };
  }

  // Check if poll has ended
  if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
    return { error: "Poll has ended" };
  }

  // Check if user already voted
  const { data: existingVote } = await supabase
    .from("poll_votes")
    .select("id")
    .eq("poll_id", pollId)
    .eq("user_id", session.userId)
    .single();

  if (existingVote) {
    // Update existing vote
    const { error } = await supabase
      .from("poll_votes")
      .update({ option_index: optionIndex })
      .eq("poll_id", pollId)
      .eq("user_id", session.userId);

    if (error) {
      console.error("Failed to update vote:", error);
      return { error: "Failed to update vote" };
    }
  } else {
    // Create new vote
    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      user_id: session.userId,
      option_index: optionIndex,
    });

    if (error) {
      console.error("Failed to create vote:", error);
      return { error: "Failed to submit vote" };
    }
  }

  revalidatePath(`/${eventSlug}/polls`);
  return { success: true };
}

export async function createPoll(
  eventId: string,
  eventSlug: string,
  data: {
    question: string;
    options: string[];
    ends_at?: string;
    is_active?: boolean;
  },
  adminCode?: string
) {
  try {
    const supabase = await createServiceClient();

    const auth = await validateAdminAccess(supabase, eventId, adminCode);
    if (!auth.valid) {
      return { error: auth.error || "Not authorized. Admin access required." };
    }

    const { data: poll, error } = await supabase
      .from("polls")
      .insert({
        event_id: eventId,
        question: data.question,
        options: data.options,
        ends_at: data.ends_at || null,
        is_active: data.is_active ?? false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("createPoll: Failed to create poll:", error);
      return { error: `Failed to create poll: ${error.message}` };
    }

    revalidatePath(getAdminPollsPath(eventSlug, adminCode));
    revalidatePath(`/${eventSlug}/polls`);
    return { success: true, pollId: poll.id };
  } catch (error) {
    console.error("createPoll: Exception:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("Missing") || errorMessage.includes("environment")) {
      return { error: "Server configuration error. Please contact support." };
    }
    return { error: `Failed to create poll: ${errorMessage}` };
  }
}

export async function updatePoll(
  pollId: string,
  eventSlug: string,
  data: {
    question?: string;
    options?: string[];
    ends_at?: string | null;
    is_active?: boolean;
    show_results?: boolean;
  },
  adminCode?: string
) {
  const supabase = await createServiceClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("event_id")
    .eq("id", pollId)
    .single();

  if (!poll) {
    return { error: "Poll not found" };
  }

  const auth = await validateAdminAccess(supabase, poll.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("polls")
    .update(data)
    .eq("id", pollId);

  if (error) {
    console.error("Failed to update poll:", error);
    return { error: "Failed to update poll" };
  }

  revalidatePath(getAdminPollsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/polls`);
  return { success: true };
}

export async function deletePoll(pollId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("event_id")
    .eq("id", pollId)
    .single();

  if (!poll) {
    return { error: "Poll not found" };
  }

  const auth = await validateAdminAccess(supabase, poll.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase.from("polls").delete().eq("id", pollId);

  if (error) {
    console.error("Failed to delete poll:", error);
    return { error: "Failed to delete poll" };
  }

  revalidatePath(getAdminPollsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/polls`);
  return { success: true };
}

export async function togglePollActive(pollId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("is_active, event_id")
    .eq("id", pollId)
    .single();

  if (!poll) {
    return { error: "Poll not found" };
  }

  const auth = await validateAdminAccess(supabase, poll.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("polls")
    .update({ is_active: !poll.is_active })
    .eq("id", pollId);

  if (error) {
    console.error("Failed to toggle poll:", error);
    return { error: "Failed to toggle poll" };
  }

  revalidatePath(getAdminPollsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/polls`);

  // Fan-out notification when poll goes live
  if (!poll.is_active) {
    const { data: pollData } = await supabase
      .from("polls")
      .select("question")
      .eq("id", pollId)
      .single();

    fanOutNotification(
      poll.event_id,
      "poll_opened",
      "New Poll Open",
      pollData?.question ?? "A new poll is now live — go vote!",
      `/${eventSlug}/polls`
    ).catch(() => {});
  }

  return { success: true, is_active: !poll.is_active };
}

/**
 * Automatically deactivate polls that have expired
 * This should be called when loading polls to ensure expired polls are marked as inactive
 */
export async function deactivateExpiredPolls(eventId: string, eventSlug?: string): Promise<number> {
  try {
    const supabase = await createServiceClient();
    const now = new Date().toISOString();

    // Find all active polls that have expired
    const { data: expiredPolls, error: fetchError } = await supabase
      .from("polls")
      .select("id")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .not("ends_at", "is", null)
      .lt("ends_at", now);

    if (fetchError) {
      console.error("[deactivateExpiredPolls] Error fetching expired polls:", fetchError);
      return 0;
    }

    if (!expiredPolls || expiredPolls.length === 0) {
      return 0;
    }

    // Deactivate all expired polls
    const pollIds = expiredPolls.map(p => p.id);
    const { error: updateError } = await supabase
      .from("polls")
      .update({ is_active: false })
      .in("id", pollIds);

    if (updateError) {
      console.error("[deactivateExpiredPolls] Error deactivating polls:", updateError);
      return 0;
    }

    console.log(`[deactivateExpiredPolls] Deactivated ${expiredPolls.length} expired poll(s)`);

    // Revalidate paths if eventSlug is provided
    if (eventSlug) {
      revalidatePath(getAdminPollsPath(eventSlug));
      revalidatePath(`/${eventSlug}/polls`);
    }

    return expiredPolls.length;
  } catch (error) {
    console.error("[deactivateExpiredPolls] Exception:", error);
    return 0;
  }
}
