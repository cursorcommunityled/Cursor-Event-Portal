import { notFound } from "next/navigation";
import { getEventBySlug, getAnnouncements, getPublishedCompetitionJudgingResults } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { createServiceClient } from "@/lib/supabase/server";
import { EventHeader } from "@/components/layout/EventHeader";
import { EventNavWrapper } from "@/components/layout/EventNavWrapper";
import { AttendeeChatWidget } from "@/components/chatbot/AttendeeChatWidget";
import { EasterEggOverlay } from "@/components/easter/EasterEggOverlay";
import { JudgingWinnersReveal } from "@/components/hackathon-judging/JudgingWinnersReveal";
import type { HackathonProfile } from "@/types";

export const dynamic = "force-dynamic";

interface MainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ eventSlug: string }>;
}

export default async function MainLayout({ children, params }: MainLayoutProps) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);

  if (!event) {
    notFound();
  }

  const [session, announcements, judgingResults] = await Promise.all([
    getSession(),
    getAnnouncements(event.id),
    getPublishedCompetitionJudgingResults(event.id),
  ]);
  const latestAnnouncement = announcements[0] || null;
  const userId = session?.eventId === event.id ? session.userId : undefined;

  let hackathonProfile = null;
  let userName = "";
  if (userId) {
    const supabase = await createServiceClient();

    // Fetch user name
    const { data: userData } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    userName = userData?.name || "";

    if (event.is_hackathon) {
      const { data } = await supabase
        .from("hackathon_profiles")
        .select("user_id, event_id, occupation, is_technical, unique_skill, linkedin_url, needs_team, accessibility, profile_bio, project_interests, collaboration_style, looking_for_teammates, created_at, updated_at")
        .eq("event_id", event.id)
        .eq("user_id", userId)
        .maybeSingle();
      hackathonProfile = data;
    }
  }

  return (
    <div className="min-h-screen bg-black-gradient flex flex-col pb-56 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <EventHeader event={event} announcement={latestAnnouncement} userId={userId} userName={userName} hackathonProfile={hackathonProfile as HackathonProfile | null} />

      {children}

      <EventNavWrapper eventSlug={eventSlug} event={event} userId={userId} />
      <AttendeeChatWidget eventSlug={eventSlug} eventName={event.name} userId={userId} />
      <JudgingWinnersReveal eventId={event.id} initialResults={judgingResults} />
      {eventSlug === "calgary-march-2026" && (
        <EasterEggOverlay eventSlug={eventSlug} eventId={event.id} userId={userId} />
      )}
    </div>
  );
}
