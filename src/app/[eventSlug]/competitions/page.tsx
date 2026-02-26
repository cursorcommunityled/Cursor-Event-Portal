import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getActiveCompetitions } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { EventHeader } from "@/components/layout/EventHeader";
import { EventNavWrapper } from "@/components/layout/EventNavWrapper";
import { CompetitionsList } from "@/components/competitions/CompetitionsList";
import { getAnnouncements } from "@/lib/supabase/queries";
import { createServiceClient } from "@/lib/supabase/server";

interface CompetitionsPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function CompetitionsPage({ params }: CompetitionsPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const intakeStatus = await getIntakeStatus(event.id, session.userId);
  if (!intakeStatus.completed && !intakeStatus.skipped) {
    redirect(`/${eventSlug}/intake`);
  }

  const supabase = await createServiceClient();
  const { data: userRecord } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();
  const isAdmin = !!userRecord && ["staff", "admin"].includes(userRecord.role);

  console.log("[CompetitionsPage] Fetching for event:", event.id, event.slug);
  const [competitions, announcements] = await Promise.all([
    getActiveCompetitions(event.id),
    getAnnouncements(event.id),
  ]);
  console.log("[CompetitionsPage] Found", competitions.length, "competitions:", competitions.map(c => ({ id: c.id, title: c.title, status: c.status })));

  const latestAnnouncement = announcements[0] || null;

  return (
    <div className="min-h-screen bg-black-gradient flex flex-col pb-56 relative">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <EventHeader event={event} announcement={latestAnnouncement} userId={session.userId} />

      <main className="max-w-3xl mx-auto w-full px-6 py-12 space-y-12 min-w-0">
        <div className="animate-fade-in space-y-2">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
            Showcase
          </p>
          <h1 className="text-4xl font-light text-white tracking-tight">
            Competitions
          </h1>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CompetitionsList
            initialCompetitions={competitions}
            eventId={event.id}
            eventSlug={eventSlug}
            userId={session.userId}
            isAdmin={isAdmin}
          />
        </div>
      </main>

      <EventNavWrapper eventSlug={eventSlug} event={event} userId={session.userId} />
    </div>
  );
}
