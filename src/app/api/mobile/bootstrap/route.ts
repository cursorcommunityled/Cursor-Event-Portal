import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Aggregated attendee bootstrap payload for the mobile app.
 * Authenticated; scoped to the session event.
 */
export async function GET(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    const supabase = await createServiceClient();
    const eventId = session.eventId;
    const sections = request.nextUrl.searchParams.get("sections")?.split(",") ?? [
      "agenda",
      "announcements",
      "polls",
      "questions",
      "help",
      "competitions",
      "photos",
      "slides",
      "exchange",
      "credits",
      "hackathon",
      "sessions",
      "table",
    ];

    const result: Record<string, unknown> = { eventId };

    const tasks: Promise<void>[] = [];

    if (sections.includes("agenda")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("agenda_items")
            .select("*")
            .eq("event_id", eventId)
            .order("start_time", { ascending: true });
          result.agenda = data ?? [];
        })()
      );
    }

    if (sections.includes("announcements")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("announcements")
            .select("*")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false })
            .limit(50);
          result.announcements = data ?? [];
        })()
      );
    }

    if (sections.includes("polls")) {
      tasks.push(
        (async () => {
          const { data: polls } = await supabase
            .from("polls")
            .select("*, poll_votes(*)")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false });
          result.polls = polls ?? [];
        })()
      );
    }

    if (sections.includes("questions")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("questions")
            .select("*, answers(*), users(id, name), question_upvotes(user_id)")
            .eq("event_id", eventId)
            .neq("status", "hidden")
            .order("created_at", { ascending: false });
          result.questions = data ?? [];
        })()
      );
    }

    if (sections.includes("help")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("help_requests")
            .select("*, users!help_requests_user_id_fkey(id, name)")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false })
            .limit(100);
          result.helpRequests = data ?? [];
        })()
      );
    }

    if (sections.includes("competitions")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("competitions")
            .select(
              "*, competition_entries(*, users(id, name), competition_votes(*))"
            )
            .eq("event_id", eventId)
            .order("created_at", { ascending: false });
          result.competitions = data ?? [];
        })()
      );
    }

    if (sections.includes("photos")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("event_photos")
            .select("*")
            .eq("event_id", eventId)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(100);
          result.photos = data ?? [];
        })()
      );
    }

    if (sections.includes("slides")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("slide_decks")
            .select("*")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false })
            .limit(5);
          result.slideDecks = data ?? [];
        })()
      );
    }

    if (sections.includes("exchange")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("exchange_posts")
            .select("*, users!exchange_posts_user_id_fkey(id, name)")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false });
          result.exchangePosts = data ?? [];
        })()
      );
    }

    if (sections.includes("credits")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("cursor_credits")
            .select("*")
            .eq("event_id", eventId)
            .eq("assigned_to", session.userId);
          result.credits = data ?? [];
        })()
      );
    }

    if (sections.includes("table")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("table_registrations")
            .select("*")
            .eq("event_id", eventId)
            .eq("user_id", session.userId)
            .order("registered_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          result.tableAssignment = data;
        })()
      );
    }

    if (sections.includes("sessions")) {
      tasks.push(
        (async () => {
          const [{ data: settings }, { data: slots }, { data: mentors }] =
            await Promise.all([
              supabase
                .from("demo_signup_settings")
                .select("*")
                .eq("event_id", eventId)
                .maybeSingle(),
              supabase
                .from("demo_slots")
                .select("*, demo_slot_signups(*)")
                .eq("event_id", eventId)
                .order("starts_at", { ascending: true }),
              supabase
                .from("mentors")
                .select("*")
                .eq("event_id", eventId)
                .order("display_order", { ascending: true }),
            ]);
          result.sessionSettings = settings;
          result.demoSlots = slots ?? [];
          result.mentors = mentors ?? [];
        })()
      );
    }

    if (sections.includes("hackathon")) {
      tasks.push(
        (async () => {
          const [
            { data: settings },
            { data: teams },
            { data: invites },
            { data: profiles },
            { data: channels },
          ] = await Promise.all([
            supabase
              .from("hackathon_settings")
              .select("*")
              .eq("event_id", eventId)
              .maybeSingle(),
            supabase
              .from("hackathon_teams")
              .select(
                "*, hackathon_team_members(*, users(id, name, email)), hackathon_projects(*), hackathon_scores(*)"
              )
              .eq("event_id", eventId)
              .order("created_at", { ascending: true }),
            supabase
              .from("hackathon_team_invites")
              .select("*")
              .eq("event_id", eventId)
              .or(
                `invited_user_id.eq.${session.userId},inviter_user_id.eq.${session.userId}`
              ),
            supabase
              .from("hackathon_profiles")
              .select("*")
              .eq("event_id", eventId),
            supabase
              .from("hackathon_chat_channels")
              .select("*")
              .eq("event_id", eventId)
              .order("created_at", { ascending: true }),
          ]);
          result.hackathonSettings = settings;
          result.hackathonTeams = teams ?? [];
          result.hackathonInvites = invites ?? [];
          result.hackathonProfiles = profiles ?? [];
          result.hackathonChannels = channels ?? [];
        })()
      );
    }

    await Promise.all(tasks);
    return NextResponse.json(result);
  });
}
