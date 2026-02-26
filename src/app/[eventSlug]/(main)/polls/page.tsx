import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getActivePollsWithVotes } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { PollsList } from "@/components/polls/PollsList";

interface PollsPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function PollsPage({ params }: PollsPageProps) {
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

  const { deactivateExpiredPolls } = await import("@/lib/actions/polls");
  await deactivateExpiredPolls(event.id, eventSlug);

  const polls = await getActivePollsWithVotes(event.id, session.userId);

  return (
    <main className="max-w-lg mx-auto w-full px-6 py-12 space-y-12">
      <div className="animate-fade-in space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
          Live
        </p>
        <h1 className="text-4xl font-light text-white tracking-tight">
          Polls
        </h1>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <PollsList
          initialPolls={polls}
          eventId={event.id}
          eventSlug={eventSlug}
          userId={session.userId}
        />
      </div>
    </main>
  );
}
