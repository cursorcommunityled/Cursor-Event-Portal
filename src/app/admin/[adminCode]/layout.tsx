import { CopilotWidget } from "@/components/admin/CopilotWidget";
import { getEventForAdmin } from "@/lib/utils/admin";

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ adminCode: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { adminCode } = await params;

  let eventId: string | null = null;
  try {
    const event = await getEventForAdmin(adminCode);
    eventId = event.id;
  } catch {
    // Invalid admin code — let the child page handle the error
  }

  return (
    <>
      {children}
      {eventId && <CopilotWidget eventId={eventId} adminCode={adminCode} />}
    </>
  );
}
