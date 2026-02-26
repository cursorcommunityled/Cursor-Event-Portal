import { getEventForAdmin } from "@/lib/utils/admin";
import {
  getOrCreateDemoSettings,
  getDemoSlotsWithCounts,
  syncDemoSlotsForWindow,
} from "@/lib/demo/service";
import { DemosAdminClient } from "@/app/admin/_clients/demos/DemosAdminClient";

interface AdminDemosPageProps {
  params: Promise<{ adminCode: string }>;
}

export default async function AdminDemosPage({ params }: AdminDemosPageProps) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);
  const settings = await getOrCreateDemoSettings(event);
  await syncDemoSlotsForWindow(event.id, settings.opens_at, settings.closes_at);
  const slots = await getDemoSlotsWithCounts(event.id);

  return (
    <DemosAdminClient
      event={event}
      adminCode={adminCode}
      settings={settings}
      slots={slots}
    />
  );
}
