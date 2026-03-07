import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fanOutNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Called by Render cron or any scheduler with:
//   Authorization: Bearer <CRON_SECRET>
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Fetch all pending items that are due
  const { data: items, error } = await supabase
    .from("scheduled_items")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now);

  if (error) {
    console.error("[cron/process-scheduled] fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const processed: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const item of items || []) {
    try {
      if (item.type === "announcement") {
        // Fetch the event slug so we can build the action path
        const { data: event } = await supabase
          .from("events")
          .select("id, slug")
          .eq("id", item.event_id)
          .single();

        // Insert the announcement
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        await supabase.from("announcements").insert({
          event_id: item.event_id,
          content: item.content,
          priority: 0,
          published_at: new Date().toISOString(),
          expires_at: expiresAt,
        });

        // Fan-out in-app notification
        await fanOutNotification(
          item.event_id,
          "announcement",
          "New Announcement",
          item.content || "",
          event ? `/${event.slug}` : undefined
        );

      } else if (item.type === "poll") {
        const options = item.poll_options as string[] | null;
        if (!item.poll_question || !options?.length) {
          throw new Error("Missing poll question or options");
        }

        const { data: event } = await supabase
          .from("events")
          .select("id, slug")
          .eq("id", item.event_id)
          .single();

        let ends_at: string | null = null;
        if (item.poll_duration_minutes) {
          ends_at = new Date(Date.now() + item.poll_duration_minutes * 60 * 1000).toISOString();
        }

        // Insert the poll as active
        const { data: poll } = await supabase
          .from("polls")
          .insert({
            event_id: item.event_id,
            question: item.poll_question,
            options,
            ends_at,
            is_active: true,
          })
          .select("id")
          .single();

        // Fan-out notification
        await fanOutNotification(
          item.event_id,
          "poll_opened",
          "New Poll Open",
          item.poll_question,
          event ? `/${event.slug}/polls` : undefined
        );
      }

      // Mark as sent
      await supabase
        .from("scheduled_items")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", item.id);

      processed.push(item.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron] Failed to process item ${item.id}:`, msg);
      failed.push({ id: item.id, error: msg });
    }
  }

  return NextResponse.json({
    processed: processed.length,
    failed: failed.length,
    processedIds: processed,
    failedItems: failed,
  });
}
