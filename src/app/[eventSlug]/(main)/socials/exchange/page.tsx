import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getOpenExchangePosts } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { createServiceClient } from "@/lib/supabase/server";
import { SocialsSubNav } from "@/components/layout/SocialsSubNav";
import { ExchangeBoard } from "@/components/exchange/ExchangeBoard";

interface SocialsExchangePageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function SocialsExchangePage({ params }: SocialsExchangePageProps) {
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

  const [posts, tableReg] = await Promise.all([
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
  ]);

  return (
    <main className="max-w-[40rem] mx-auto w-full px-6 py-12 space-y-12">
      <SocialsSubNav eventSlug={eventSlug} />

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
    </main>
  );
}
