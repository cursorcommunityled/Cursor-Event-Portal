import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getOpenExchangePosts, getNetworkingSession, getNetworkingCurrentRound, getUserNetworkingPair } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { createServiceClient } from "@/lib/supabase/server";
import { SocialsSubNav } from "@/components/layout/SocialsSubNav";
import { ExchangeBoard } from "@/components/exchange/ExchangeBoard";
import { NetworkingView } from "@/components/networking/NetworkingView";

interface SocialsExchangePageProps {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function SocialsExchangePage({ params, searchParams }: SocialsExchangePageProps) {
  const { eventSlug } = await params;
  const { view } = await searchParams;

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

  const activeView = view === "networking" ? "networking" : "exchange";

  const [posts, tableReg, networkingSession] = await Promise.all([
    getOpenExchangePosts(event.id),
    (async () => {
      const supabase = await createServiceClient();
      const { data } = await supabase
        .from("table_registrations")
        .select("table_number")
        .eq("event_id", event.id)
        .eq("user_id", session.userId)
        .order("registered_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    })(),
    getNetworkingSession(event.id),
  ]);

  const round = networkingSession ? await getNetworkingCurrentRound(networkingSession.id) : null;
  const pair = round ? await getUserNetworkingPair(round.id, session.userId) : null;

  return (
    <main className="max-w-[40rem] mx-auto w-full px-6 py-12 space-y-12">
      <SocialsSubNav eventSlug={eventSlug} />

      {/* Inner sub-toggle */}
      <div className="flex items-center gap-2 animate-fade-in">
        <a
          href={`/${eventSlug}/socials/exchange`}
          className={`px-5 py-2.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-300 ${
            activeView === "exchange"
              ? "bg-white text-black shadow-glow"
              : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
          }`}
        >
          Exchange
        </a>
        <a
          href={`/${eventSlug}/socials/exchange?view=networking`}
          className={`px-5 py-2.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-300 ${
            activeView === "networking"
              ? "bg-white text-black shadow-glow"
              : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
          }`}
        >
          Networking
        </a>
      </div>

      {activeView === "exchange" && (
        <>
          <div className="flex items-end justify-between animate-fade-in">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
                Need / Offer
              </p>
              <h1 className="text-4xl font-light text-white tracking-tight">
                Exchange
              </h1>
            </div>
          </div>

          <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
            <ExchangeBoard
              event={{ id: event.id, slug: event.slug }}
              initialPosts={posts}
              currentUserId={session.userId}
              userTableNumber={tableReg?.table_number ?? null}
            />
          </div>
        </>
      )}

      {activeView === "networking" && (
        <>
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
        </>
      )}
    </main>
  );
}
