import { getAgendaItems } from "@/lib/supabase/queries";
import { AgendaAdminClient } from "../../_clients/agenda/AgendaAdminClient";
import { getEventForAdmin } from "@/lib/utils/admin";

interface AdminAgendaPageProps {
  params: Promise<{ adminCode: string }>;
}

export default async function AdminAgendaPage({ params }: AdminAgendaPageProps) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);
  const items = await getAgendaItems(event.id);

  return <AgendaAdminClient event={event} eventSlug={event.slug} initialItems={items} />;
}
