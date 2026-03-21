import { notFound, redirect } from "next/navigation";
import {
  getEventBySlug,
  getAgendaItems,
  getSeriesEvents,
  getEventThemeSelection,
} from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { fetchMyCredits } from "@/lib/actions/cursor-credits";
import { EventPageClient } from "@/components/agenda/EventPageClient";

interface AgendaPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function AgendaPage({ params }: AgendaPageProps) {
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

  const [items, seriesEvents, themeSelection, credits] = await Promise.all([
    getAgendaItems(event.id),
    event.series_id ? getSeriesEvents(event.series_id) : Promise.resolve([]),
    getEventThemeSelection(event.id),
    fetchMyCredits(event.id, session.userId),
  ]);

  const activeTheme = themeSelection?.theme ?? null;

  return (
    <EventPageClient
      event={event}
      agendaItems={items}
      seriesEvents={seriesEvents}
      activeTheme={activeTheme}
      credits={credits}
      userId={session.userId}
    />
  );
}
