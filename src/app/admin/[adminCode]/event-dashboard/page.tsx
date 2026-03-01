import {
  getAgendaItems,
  getConversationThemes,
  getEventThemeSelection,
  getPlannedEvents,
  getEventCalendarCities,
  getAllEvents,
  getActiveEventSlug,
  getVenues,
  getSlideDeck,
  getAllCompetitions,
} from "@/lib/supabase/queries";
import { getOrCreateDemoSettings, getDemoSlotsWithCounts, syncDemoSlotsForWindow } from "@/lib/demo/service";
import { EventDashboardClient } from "../../_clients/[adminCode]/event-dashboard/EventDashboardClient";
import { getEventForAdmin } from "@/lib/utils/admin";

interface EventDashboardPageProps {
  params: Promise<{ adminCode: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_TABS = ["agenda", "demos", "slides", "competitions", "themes", "calendar"] as const;
type TabType = typeof VALID_TABS[number];

export default async function EventDashboardPage({
  params,
  searchParams,
}: EventDashboardPageProps) {
  const { adminCode } = await params;
  const { tab } = await searchParams;

  const activeTab: TabType = VALID_TABS.includes(tab as TabType) ? (tab as TabType) : "agenda";

  const event = await getEventForAdmin(adminCode);

  const [agendaItems, themes, themeSelection, plannedEvents, calendarCities, allEvents, activeSlug, venues, slideDeck, competitions] = await Promise.all([
    getAgendaItems(event.id),
    getConversationThemes(),
    getEventThemeSelection(event.id),
    getPlannedEvents(),
    getEventCalendarCities(),
    getAllEvents(),
    getActiveEventSlug(),
    getVenues(),
    getSlideDeck(event.id),
    getAllCompetitions(event.id),
  ]);

  let demoSettings = null;
  let demoSlots: Awaited<ReturnType<typeof getDemoSlotsWithCounts>> = [];
  try {
    demoSettings = await getOrCreateDemoSettings(event);
    await syncDemoSlotsForWindow(event.id, demoSettings.opens_at, demoSettings.closes_at);
    demoSlots = await getDemoSlotsWithCounts(event.id);
  } catch {
    // demos not configured for this event
  }

  return (
    <EventDashboardClient
      event={event}
      eventSlug={event.slug}
      adminCode={adminCode}
      initialAgendaItems={agendaItems}
      themes={themes}
      themeSelection={themeSelection}
      plannedEvents={plannedEvents}
      calendarCities={calendarCities}
      allEvents={allEvents}
      activeSlug={activeSlug}
      venues={venues}
      demoSettings={demoSettings}
      demoSlots={demoSlots}
      initialDeck={slideDeck}
      initialCompetitions={competitions}
      activeTab={activeTab}
    />
  );
}
