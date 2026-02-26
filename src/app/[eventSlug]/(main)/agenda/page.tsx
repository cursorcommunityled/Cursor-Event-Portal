import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getAgendaItems, getSeriesEvents } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { AgendaList } from "@/components/agenda/AgendaList";
import { EventSeriesSection } from "@/components/agenda/EventSeriesSection";

interface AgendaPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function AgendaPage({ params }: AgendaPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    notFound();
  }

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const intakeStatus = await getIntakeStatus(event.id, session.userId);
  if (!intakeStatus.completed && !intakeStatus.skipped) {
    redirect(`/${eventSlug}/intake`);
  }

  const [items, seriesEvents] = await Promise.all([
    getAgendaItems(event.id),
    event.series_id ? getSeriesEvents(event.series_id) : Promise.resolve([]),
  ]);

  return (
    <main className="max-w-[704px] mx-auto w-full px-6 py-12 space-y-12">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium animate-slide-up" style={{ animationDelay: "100ms" }}>
          Schedule
        </p>
        <h1 className="text-4xl font-light text-white tracking-tight animate-slide-up" style={{ animationDelay: "200ms" }}>
          Agenda
        </h1>
      </div>

      {event.series_id && seriesEvents.length > 0 && (
        <EventSeriesSection currentEventId={event.id} seriesEvents={seriesEvents} />
      )}

      <div className="animate-slide-up" style={{ animationDelay: "300ms" }}>
        <AgendaList
          items={items}
          eventId={event.id}
          eventTimezone={event.timezone || "America/Edmonton"}
          eventStartTime={event.start_time}
        />
      </div>
    </main>
  );
}
