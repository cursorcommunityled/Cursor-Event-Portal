import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getHelpRequests } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { SocialsSubNav } from "@/components/layout/SocialsSubNav";
import { HelpRequestForm } from "@/components/help/HelpRequestForm";
import { HelpRequestList } from "@/components/help/HelpRequestList";

interface SocialsHelpPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function SocialsHelpPage({ params }: SocialsHelpPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    notFound();
  }

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const intakeStatus = await getIntakeStatus(event.id, session.userId);
  if (!intakeStatus.completed && !intakeStatus.skipped) {
    redirect(`/${eventSlug}/intake`);
  }

  const requests = await getHelpRequests(event.id, session.userId);

  return (
    <main className="max-w-[40rem] mx-auto w-full px-6 py-12 space-y-12">
      <SocialsSubNav eventSlug={eventSlug} />

      <div className="flex items-end justify-between animate-fade-in">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
            Support
          </p>
          <h1 className="text-4xl font-light text-white tracking-tight">
            Help Desk
          </h1>
        </div>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <HelpRequestForm eventId={event.id} eventSlug={eventSlug} />
      </div>

      <HelpRequestList initialRequests={requests} eventId={event.id} userId={session.userId} />
    </main>
  );
}
