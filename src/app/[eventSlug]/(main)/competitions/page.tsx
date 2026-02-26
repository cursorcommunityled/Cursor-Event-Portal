import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getActiveCompetitions } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { createServiceClient } from "@/lib/supabase/server";
import { CompetitionsList } from "@/components/competitions/CompetitionsList";

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

  const competitions = await getActiveCompetitions(event.id);

  return (
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
  );
}
