import { createServiceClient } from "@/lib/supabase/server";
import { getEventIntakes, getSuggestedGroups, getTableQRCodes } from "@/lib/supabase/queries";
import { AttendanceHubClient } from "@/app/admin/_clients/[adminCode]/checkin/AttendanceHubClient";
import { getEventForAdmin } from "@/lib/utils/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AdminCheckInPageProps {
  params: Promise<{ adminCode: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminCheckInPage({ params, searchParams }: AdminCheckInPageProps) {
  const { adminCode } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "seating" ? "seating" : "checkin";

  const event = await getEventForAdmin(adminCode);
  const supabase = await createServiceClient();

  const [registrationsResult, checkedInResult, registrationsData, agendaItemsResult, intakes, groups, qrCodes] = await Promise.all([
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).not("checked_in_at", "is", null),
    supabase.from("registrations").select("*, user:users(*, intakes:attendee_intakes(*))").eq("event_id", event.id).eq("user.intakes.event_id", event.id).order("created_at", { ascending: false }),
    supabase.from("agenda_items").select("*").eq("event_id", event.id).order("sort_order", { ascending: true }),
    getEventIntakes(event.id),
    getSuggestedGroups(event.id),
    getTableQRCodes(event.id),
  ]);

  const stats = { registered: registrationsResult.count || 0, checkedIn: checkedInResult.count || 0 };
  const registrations = registrationsData.data || [];
  const agendaItems = agendaItemsResult.data || [];

  return (
    <AttendanceHubClient
      event={event}
      eventSlug={event.slug}
      adminCode={adminCode}
      initialRegistrations={registrations}
      stats={stats}
      initialAgendaItems={agendaItems}
      intakes={intakes}
      groups={groups}
      qrCodes={qrCodes}
      activeTab={activeTab}
    />
  );
}
