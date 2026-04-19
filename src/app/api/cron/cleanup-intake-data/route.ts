import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// This endpoint should be called by a cron job service (e.g., cron-job.org, GitHub Actions, Render cron).
// It MUST be called with `Authorization: Bearer <CRON_SECRET_KEY>`. If the
// env var is unset on the server we fail closed so the endpoint cannot be
// triggered by an unauthenticated request.
export async function POST(request: NextRequest) {
  try {
    const expectedKey = process.env.CRON_SECRET_KEY;
    if (!expectedKey) {
      console.error("[cleanup-intake-data] CRON_SECRET_KEY is not set; refusing to run.");
      return NextResponse.json(
        { error: "Endpoint disabled (missing CRON_SECRET_KEY)" },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createServiceClient();
    const now = new Date();

    // Get all events that have ended
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, end_time, data_retention_days")
      .not("end_time", "is", null);

    if (eventsError) {
      console.error("[cleanup-intake-data] Error fetching events:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No events to process",
        deleted: 0,
      });
    }

    let totalDeleted = 0;
    const results: Array<{ eventId: string; deleted: number; error?: string }> = [];

    for (const event of events) {
      try {
        const endTime = new Date(event.end_time);
        const retentionDays = event.data_retention_days || 60; // Default to 60 days
        const cutoffDate = new Date(endTime);
        cutoffDate.setDate(cutoffDate.getDate() + retentionDays);

        // Only delete if retention period has passed
        if (now < cutoffDate) {
          continue;
        }

        // Get count before deletion
        const { count: countResult } = await supabase
          .from("attendee_intakes")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id);
        
        // Delete intake data for this event
        const { error: deleteError } = await supabase
          .from("attendee_intakes")
          .delete()
          .eq("event_id", event.id);
        
        const count = countResult || 0;

        if (deleteError) {
          console.error(`[cleanup-intake-data] Error deleting intakes for event ${event.id}:`, deleteError);
          results.push({
            eventId: event.id,
            deleted: 0,
            error: deleteError.message,
          });
        } else {
          const deletedCount = count || 0;
          totalDeleted += deletedCount;
          results.push({
            eventId: event.id,
            deleted: deletedCount,
          });
          console.log(`[cleanup-intake-data] Deleted ${deletedCount} intake records for event ${event.id}`);
        }
      } catch (error) {
        console.error(`[cleanup-intake-data] Exception processing event ${event.id}:`, error);
        results.push({
          eventId: event.id,
          deleted: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${events.length} events`,
      totalDeleted,
      results,
    });
  } catch (error) {
    console.error("[cleanup-intake-data] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing and cron services that only support GET
export async function GET(request: NextRequest) {
  return POST(request);
}
