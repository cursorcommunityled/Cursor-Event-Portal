import { notFound } from "next/navigation";
import { getEventForAdmin } from "@/lib/utils/admin";
import {
  getOrCreateDemoSettings,
  getDemoSlotsWithCounts,
} from "@/lib/demo/service";
import { getMentors } from "@/lib/supabase/queries";
import { DemosAdminClient } from "@/app/admin/_clients/demos/DemosAdminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AdminSessionsPageProps {
  params: Promise<{ adminCode: string }>;
}

export default async function AdminSessionsPage({ params }: AdminSessionsPageProps) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);
  let settings;
  let slots;
  try {
    settings = await getOrCreateDemoSettings(event);
    slots = await getDemoSlotsWithCounts(event.id);
  } catch {
    notFound();
  }

  const mentors = await getMentors(event.id);

  return (
    <DemosAdminClient
      event={event}
      adminCode={adminCode}
      settings={settings}
      slots={slots}
      mentors={mentors}
    />
  );
}
