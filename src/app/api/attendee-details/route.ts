import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Check if user is admin or staff
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (!user || !["admin", "staff"].includes(user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const eventId = searchParams.get("eventId");

    if (!userId || !eventId) {
      return NextResponse.json(
        { error: "userId and eventId are required" },
        { status: 400 }
      );
    }

    // Fetch intake data
    const { data: intake } = await supabase
      .from("attendee_intakes")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .single();

    // Fetch poll votes
    const { data: pollVotes } = await supabase
      .from("poll_votes")
      .select(`
        *,
        poll:polls(
          id,
          question,
          options,
          created_at
        )
      `)
      .eq("user_id", userId);

    // Fetch questions asked by user
    const { data: questions } = await supabase
      .from("questions")
      .select(`
        *,
        answers:answers(
          id,
          content,
          is_accepted,
          created_at,
          user:users(id, name)
        )
      `)
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Fetch answers provided by user
    const { data: answers } = await supabase
      .from("answers")
      .select(`
        *,
        question:questions(
          id,
          content,
          event_id,
          created_at
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Filter answers to only this event
    const eventAnswers = (answers || []).filter(
      (answer) => answer.question && (answer.question as any).event_id === eventId
    );

    // Fetch question upvotes
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
      .eq("user_id", userId);

    const eventUpvotes = (upvotes || []).filter(
      (upvote) => upvote.question && (upvote.question as any).event_id === eventId
    );

    // Fetch user info
    const { data: userData } = await supabase
      .from("users")
      .select("id, name, email, role, created_at")
      .eq("id", userId)
      .single();

    return NextResponse.json({
      user: userData,
      intake: intake || null,
      pollVotes: pollVotes || [],
      questions: questions || [],
      answers: eventAnswers || [],
      upvotes: eventUpvotes || [],
    });
  } catch (error) {
    console.error("Error fetching attendee details:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendee details" },
      { status: 500 }
    );
  }
}
