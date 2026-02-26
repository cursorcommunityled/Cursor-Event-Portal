import { notFound } from "next/navigation";
import { getEventBySlug, getAnnouncements } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { EventHeader } from "@/components/layout/EventHeader";
import { EventNavWrapper } from "@/components/layout/EventNavWrapper";

export const dynamic = "force-dynamic";

interface MainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ eventSlug: string }>;
}

export default async function MainLayout({ children, params }: MainLayoutProps) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);

  if (!event) {
    notFound();
  }

  const [session, announcements] = await Promise.all([
    getSession(),
    getAnnouncements(event.id),
  ]);
  const latestAnnouncement = announcements[0] || null;
  const userId = session?.eventId === event.id ? session.userId : undefined;

  return (
    <div className="min-h-screen bg-black-gradient flex flex-col pb-56 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <EventHeader event={event} announcement={latestAnnouncement} userId={userId} />

      {children}

      <EventNavWrapper eventSlug={eventSlug} event={event} userId={userId} />
    </div>
  );
}
