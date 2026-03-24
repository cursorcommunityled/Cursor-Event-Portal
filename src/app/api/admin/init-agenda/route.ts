import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Agenda templates keyed by venue ID
const AGENDA_TEMPLATES: Record<string, { title: string; description?: string; speaker?: string; image_url?: string; start_time: string; end_time: string; sort_order: number }[]> = {
  // Platform Calgary - January 28, 2026 @ 5:30 PM MST (UTC-7)
  "platform-calgary": [
    {
      title: "Arrivals and Mingle",
      description: "Welcome! Connect with fellow developers and grab a spot. Collaboration pods available throughout the venue.",
      start_time: "2026-01-29T00:30:00Z", // 5:30pm MST
      end_time: "2026-01-29T01:00:00Z",   // 6:00pm MST
      sort_order: 0,
    },
    {
      title: "Intro to Cursor",
      description: "Event introduction and welcome.",
      speaker: "Jia Ming Huang",
      start_time: "2026-01-29T01:00:00Z", // 6:00pm MST
      end_time: "2026-01-29T01:10:00Z",   // 6:10pm MST
      sort_order: 1,
    },
    {
      title: "Community Demos",
      description: "Quick demos showcasing Cursor capabilities.",
      speaker: "Simon Loewen",
      start_time: "2026-01-29T01:10:00Z", // 6:10pm MST
      end_time: "2026-01-29T01:30:00Z",   // 6:30pm MST
      sort_order: 2,
    },
    {
      title: "Building",
      description: "Collaborative building session. Work with your pod and get help from facilitators.",
      start_time: "2026-01-29T01:30:00Z", // 6:30pm MST
      end_time: "2026-01-29T02:30:00Z",   // 7:30pm MST
      sort_order: 3,
    },
    {
      title: "Networking and Judging",
      description: "Network with other attendees while judges evaluate the builds.",
      start_time: "2026-01-29T02:30:00Z", // 7:30pm MST
      end_time: "2026-01-29T02:45:00Z",   // 7:45pm MST
      sort_order: 4,
    },
    {
      title: "Build Showcase",
      description: "Quick demos from each pod followed by community voting. Prizes awarded to winners.",
      start_time: "2026-01-29T02:45:00Z", // 7:45pm MST
      end_time: "2026-01-29T03:00:00Z",   // 8:00pm MST
      sort_order: 5,
    },
    {
      title: "Wind-Down",
      description: "Continue networking and share contact information.",
      start_time: "2026-01-29T03:00:00Z", // 8:00pm MST
      end_time: "2026-01-29T03:30:00Z",   // 8:30pm MST
      sort_order: 6,
    },
  ],

  // House 831 - March 25, 2026 @ 5:30 PM MDT (UTC-6)
  "calgary-march-2026": [
    {
      title: "Arrival & Mingle",
      description:
        "Get settled in, grab a drink, and connect with fellow builders.",
      start_time: "2026-03-25T23:30:00Z", // 5:30pm MDT
      end_time: "2026-03-26T00:00:00Z",   // 6:00pm MDT
      sort_order: 0,
    },
    {
      title: "Intro to Cursor",
      description:
        "A quick overview of what Cursor can do and how to get the most out of tonight.",
      speaker: "Simon Loewen",
      start_time: "2026-03-26T00:00:00Z", // 6:00pm MDT
      end_time: "2026-03-26T00:10:00Z",   // 6:10pm MDT
      sort_order: 1,
    },
    {
      title: "Speakers",
      description:
        "Hear from builders and experts in the community. Featuring:\n- Philippe Burns, Tech Thursdays\n- Youssef Triki, Punchard.io",
      speaker: "Simon Loewen",
      start_time: "2026-03-26T00:10:00Z", // 6:10pm MDT
      end_time: "2026-03-26T00:30:00Z",   // 6:30pm MDT
      sort_order: 2,
    },
    {
      title: "Build & Egg Hunt (Credits)",
      description:
        "Build your best idea with Cursor — and hunt for hidden $50 credit Easter eggs scattered across the venue and this app. First to find wins!",
      start_time: "2026-03-26T00:30:00Z", // 6:30pm MDT
      end_time: "2026-03-26T02:00:00Z",   // 8:00pm MDT
      sort_order: 3,
    },
    {
      title: "Demos & Networking",
      description:
        "Present what you built, watch live demos, and connect with the community.",
      start_time: "2026-03-26T02:00:00Z", // 8:00pm MDT
      end_time: "2026-03-26T02:30:00Z",   // 8:30pm MDT
      sort_order: 4,
    },
  ],

  // House 831 - February 26, 2026 @ 5:30 PM MST (UTC-7)
  "house-831": [
    {
      title: "Arrivals and Mingle",
      description:
        "Welcome! Head upstairs when you arrive – that's where the event is being held. Open seating is available upstairs throughout the evening. Feel free to mingle and connect with the community.",
      start_time: "2026-02-27T00:30:00Z", // 5:30pm MST
      end_time: "2026-02-27T01:00:00Z",   // 6:00pm MST
      sort_order: 0,
    },
    {
      title: "Intro to Cursor",
      description: "Welcome and introduction to the evening.",
      speaker: "Jia Ming Huang",
      start_time: "2026-02-27T01:00:00Z", // 6:00pm MST
      end_time: "2026-02-27T01:10:00Z",   // 6:10pm MST
      sort_order: 1,
    },
    {
      title: "Brayden Clark",
      description:
        "Founder of Adventure Portal and Chaos Inc. Brayden builds massive VR worlds and is a House 831 member. He'll be sharing how he uses Cursor to build immersive experiences.",
      speaker: "Brayden Clark · Adventure Portal / Chaos Inc",
      image_url: "/speaker-brayden.jpeg",
      start_time: "2026-02-27T01:10:00Z", // 6:10pm MST
      end_time: "2026-02-27T01:20:00Z",   // 6:20pm MST
      sort_order: 2,
    },
    {
      title: "Nick Rogers",
      description:
        "Founder of Robin – building AI tools for events and businesses. Nick is a House 831 member and will share how AI is reshaping event experiences.",
      speaker: "Nick Rogers · Robin",
      image_url: "/speaker-nick.jpeg",
      start_time: "2026-02-27T01:20:00Z", // 6:20pm MST
      end_time: "2026-02-27T01:30:00Z",   // 6:30pm MST
      sort_order: 3,
    },
    {
      title: "Build",
      description:
        "Collaborative building session. Both floors are now open – head upstairs or downstairs to find your space. Work on your project and get help from the community.",
      start_time: "2026-02-27T01:30:00Z", // 6:30pm MST
      end_time: "2026-02-27T03:00:00Z",   // 8:00pm MST
      sort_order: 4,
    },
    {
      title: "Demos and Networking",
      description:
        "Show off what you built! Quick demos from the community followed by open networking. Exchange contact info and celebrate what everyone created tonight.",
      start_time: "2026-02-27T03:00:00Z", // 8:00pm MST
      end_time: "2026-02-27T03:30:00Z",   // 8:30pm MST
      sort_order: 5,
    },
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      eventSlug,
      adminCode,
      template = "platform-calgary",
      force = false,
    } = body as {
      eventSlug?: string;
      adminCode?: string;
      template?: string;
      force?: boolean;
    };

    const supabase = await createServiceClient();

    // Determine event: use provided eventSlug + adminCode, or fall back to legacy session auth
    let eventId: string;

    if (eventSlug && adminCode) {
      // Validate via admin code (new approach)
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id, admin_code")
        .eq("slug", eventSlug)
        .single();

      if (eventError || !event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      if (event.admin_code !== adminCode) {
        return NextResponse.json({ error: "Invalid admin code" }, { status: 403 });
      }

      eventId = event.id;
    } else {
      // Legacy: session-based auth (backward compat)
      const { getSession } = await import("@/lib/actions/registration");
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const { data: user } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.userId)
        .single();

      if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }

      // Fall back to active event slug for legacy calls
      const { getActiveEventSlug } = await import("@/lib/supabase/queries");
      const activeSlug = await getActiveEventSlug();
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id")
        .eq("slug", activeSlug)
        .single();

      if (eventError || !event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      eventId = event.id;
    }

    // Get selected template items
    const templateItems = AGENDA_TEMPLATES[template];
    if (!templateItems) {
      return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 });
    }

    // Check existing items
    const { data: existingItems } = await supabase
      .from("agenda_items")
      .select("id")
      .eq("event_id", eventId);

    if (existingItems && existingItems.length > 0 && !force) {
      return NextResponse.json({
        message: "Agenda items already exist",
        count: existingItems.length,
      });
    }

    // If force, delete existing items first
    if (force && existingItems && existingItems.length > 0) {
      await supabase.from("agenda_items").delete().eq("event_id", eventId);
    }

    // Insert template items
    const itemsToInsert = templateItems.map((item) => ({
      event_id: eventId,
      ...item,
    }));

    const { data, error } = await supabase
      .from("agenda_items")
      .insert(itemsToInsert)
      .select();

    if (error) {
      console.error("Error inserting agenda items:", error);
      return NextResponse.json({ error: "Failed to create agenda items" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${data.length} agenda items`,
      items: data,
    });
  } catch (error) {
    console.error("Init agenda error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
