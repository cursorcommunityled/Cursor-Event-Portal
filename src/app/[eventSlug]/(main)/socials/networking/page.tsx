import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getNetworkingSession, getNetworkingCurrentRound, getUserNetworkingPair } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { SocialsSubNav } from "@/components/layout/SocialsSubNav";
import { NetworkingView } from "@/components/networking/NetworkingView";

interface Props {
  params: Promise<{ eventSlug: string }>;
}

export default async function SocialsNetworkingPage({ params }: Props) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const intakeStatus = await getIntakeStatus(event.id, session.userId);
  if (!intakeStatus.completed && !intakeStatus.skipped) {
    redirect(`/${eventSlug}/intake`);
  }

  const networkingSession = await getNetworkingSession(event.id);
  const round = networkingSession ? await getNetworkingCurrentRound(networkingSession.id) : null;
  const pair = round ? await getUserNetworkingPair(round.id, session.userId) : null;

  return (
    <main className="max-w-[40rem] mx-auto w-full px-6 py-12 space-y-12">
      <SocialsSubNav eventSlug={eventSlug} />

      <div className="animate-fade-in space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">Live</p>
        <h1 className="text-4xl font-light text-white tracking-tight">Networking</h1>
      </div>

      <NetworkingView
        eventId={event.id}
        userId={session.userId}
        initialSession={networkingSession}
        initialRound={round}
        initialPair={pair}
      />
    </main>
  );
}
