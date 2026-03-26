import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getUserEventPhotos } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { PhotoUploadClient } from "@/components/photos/PhotoUploadClient";

interface PhotosPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function PhotosPage({ params }: PhotosPageProps) {
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

  const myPhotos = await getUserEventPhotos(event.id, session.userId);

  return (
    <main className="max-w-3xl mx-auto w-full px-6 py-12 space-y-12 min-w-0">
      <div className="animate-fade-in space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
          Community
        </p>
        <h1 className="text-4xl font-light text-white tracking-tight">
          Event Photos
        </h1>
        <p className="text-sm text-gray-500">
          Share your photos from the event. Submissions are reviewed before appearing publicly.
        </p>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <PhotoUploadClient
          eventId={event.id}
          eventSlug={eventSlug}
          initialPhotos={myPhotos}
        />
      </div>
    </main>
  );
}
