import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getSlideDeck } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { FullscreenSlideViewer } from "@/components/slides/FullscreenSlideViewer";

interface SlidesPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function SlidesPage({ params }: SlidesPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    notFound();
  }

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const slideDeck = await getSlideDeck(event.id);

  return (
    <main className="max-w-5xl mx-auto w-full px-6 py-12 space-y-10">
      <div className="animate-fade-in space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
          Presentation
        </p>
        <h1 className="text-4xl font-light text-white tracking-tight">
          Slide Deck
        </h1>
      </div>

      {!slideDeck ? (
        <div className="text-center py-24 glass rounded-[40px] border-dashed border-white/5 opacity-40">
          <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
            No slide deck uploaded
          </p>
          <p className="text-[9px] text-gray-700 mt-2">
            The slide deck will appear here once it&apos;s been uploaded by the event organizer.
          </p>
        </div>
      ) : !slideDeck.is_live ? (
        <div className="text-center py-24 glass rounded-[40px] border-dashed border-white/5 opacity-60">
          <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
            Slide deck not yet available
          </p>
          <p className="text-[9px] text-gray-700 mt-2">
            The slide deck will be made available shortly. Please check back soon.
          </p>
        </div>
      ) : (
        <FullscreenSlideViewer slideDeck={slideDeck} />
      )}
    </main>
  );
}
