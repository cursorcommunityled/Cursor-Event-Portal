import {
  getAgendaItems,
  getConversationThemes,
  getEventThemeSelection,
  getPlannedEvents,
} from "@/lib/supabase/queries";
import { EventDashboardClient } from "../../_clients/[adminCode]/event-dashboard/EventDashboardClient";
import { getEventForAdmin } from "@/lib/utils/admin";

interface EventDashboardPageProps {
  params: Promise<{ adminCode: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const revalidate = 0;

export default async function EventDashboardPage({
  params,
  searchParams,
}: EventDashboardPageProps) {
  const { adminCode } = await params;
  const { tab } = await searchParams;

  const activeTab =
    tab === "themes" || tab === "calendar" ? tab : "agenda";

  const event = await getEventForAdmin(adminCode);

  const [agendaItems, themes, themeSelection, plannedEvents] = await Promise.all([
    getAgendaItems(event.id),
    getConversationThemes(),
    getEventThemeSelection(event.id),
    getPlannedEvents(),
  ]);

  return (
    <EventDashboardClient
      event={event}
      eventSlug={event.slug}
      adminCode={adminCode}
      initialAgendaItems={agendaItems}
      themes={themes}
      themeSelection={themeSelection}
      plannedEvents={plannedEvents}
      activeTab={activeTab as "agenda" | "themes" | "calendar"}
    />
  );
}
