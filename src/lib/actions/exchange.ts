"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import type { ExchangeCategory, ExchangePostType } from "@/types";

async function revalidateExchangePaths(eventId: string, eventSlug: string, adminCode?: string) {
  revalidatePath(`/${eventSlug}/socials/exchange`);
  if (adminCode) {
    revalidatePath(`/admin/${adminCode}/social`);
  } else {
    // Look up admin code to also revalidate admin view
    const supabase = await createServiceClient();
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .single();
    if (event?.admin_code) {
      revalidatePath(`/admin/${event.admin_code}/social`);
    }
  }
}

export async function createExchangePost(
  eventId: string,
  eventSlug: string,
  data: { type: ExchangePostType; category: ExchangeCategory; title: string }
) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const title = data.title?.trim();
  if (!title) return { error: "Title is required" };
  if (title.length > 100) return { error: "Title must be 100 characters or less" };

  const supabase = await createServiceClient();

  // Look up the user's current table number
  const { data: tableReg } = await supabase
    .from("table_registrations")
    .select("table_number")
    .eq("event_id", eventId)
    .eq("user_id", session.userId)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: post, error } = await supabase
    .from("exchange_posts")
    .insert({
      event_id: eventId,
      user_id: session.userId,
      type: data.type,
      category: data.category,
      title,
      status: "open",
      table_number: tableReg?.table_number ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[createExchangePost] Error:", error);
    return { error: "Failed to create post" };
  }

  await revalidateExchangePaths(eventId, eventSlug);
  return { success: true, postId: post.id };
}

export async function claimExchangePost(
  postId: string,
  eventId: string,
  eventSlug: string
) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  // Fetch the post
  const { data: post, error: fetchErr } = await supabase
    .from("exchange_posts")
    .select("user_id, status, matched_with")
    .eq("id", postId)
    .eq("event_id", eventId)
    .single();

  if (fetchErr || !post) return { error: "Post not found" };
  if (post.user_id === session.userId) return { error: "Cannot connect with your own post" };
  if (post.status !== "open") return { error: "This post is no longer open" };

  const { error } = await supabase
    .from("exchange_posts")
    .update({ status: "matched", matched_with: session.userId })
    .eq("id", postId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[claimExchangePost] Error:", error);
    return { error: "Failed to connect" };
  }

  await revalidateExchangePaths(eventId, eventSlug);
  return { success: true };
}

export async function closeExchangePost(
  postId: string,
  eventId: string,
  eventSlug: string
) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: post, error: fetchErr } = await supabase
    .from("exchange_posts")
    .select("user_id")
    .eq("id", postId)
    .eq("event_id", eventId)
    .single();

  if (fetchErr || !post) return { error: "Post not found" };
  if (post.user_id !== session.userId) return { error: "Not authorized" };

  const { error } = await supabase
    .from("exchange_posts")
    .update({ status: "closed" })
    .eq("id", postId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[closeExchangePost] Error:", error);
    return { error: "Failed to close post" };
  }

  await revalidateExchangePaths(eventId, eventSlug);
  return { success: true };
}

export async function adminCloseExchangePost(
  postId: string,
  eventId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();

  // Validate admin
  const { data: event } = await supabase
    .from("events")
    .select("admin_code, slug")
    .eq("id", eventId)
    .single();

  if (!event || event.admin_code !== adminCode) return { error: "Not authorized" };

  const { error } = await supabase
    .from("exchange_posts")
    .update({ status: "closed" })
    .eq("id", postId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[adminCloseExchangePost] Error:", error);
    return { error: "Failed to close post" };
  }

  revalidatePath(`/${event.slug}/socials/exchange`);
  revalidatePath(`/admin/${adminCode}/social`);
  return { success: true };
}
