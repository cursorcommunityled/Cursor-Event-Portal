import { notFound } from "next/navigation";
import { getEventForAdmin } from "@/lib/utils/admin";
import {
  getOrCreateDemoSettings,
  getDemoSlotsWithCounts,
  syncDemoSlotsForWindow,
} from "@/lib/demo/service";
import { DemosAdminClient } from "@/app/admin/_clients/demos/DemosAdminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AdminDemosPageProps {
  params: Promise<{ adminCode: string }>;
}

export default async function AdminDemosPage({ params }: AdminDemosPageProps) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);
  let settings;
  let slots;
  try {
    settings = await getOrCreateDemoSettings(event);
    await syncDemoSlotsForWindow(event.id, settings.opens_at, settings.closes_at);
    slots = await getDemoSlotsWithCounts(event.id);
  } catch {
    notFound();
  }

  return (
    <DemosAdminClient
      event={event}
      adminCode={adminCode}
      settings={settings}
      slots={slots}
    />
  );
}
