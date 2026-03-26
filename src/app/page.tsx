import { getActiveEventSlug, getEventsWithApprovedPhotos, getHeroFeaturedPhotoIds } from "@/lib/supabase/queries";
import LandingPage from "@/components/landing/LandingPage";

export const revalidate = 0;

export default async function HomePage() {
  const [activeSlug, eventsWithPhotos, heroFeaturedIds] = await Promise.all([
    getActiveEventSlug(),
    getEventsWithApprovedPhotos(),
    getHeroFeaturedPhotoIds(),
  ]);
  return (
    <LandingPage
      activeEventSlug={activeSlug}
      eventsWithPhotos={eventsWithPhotos}
      heroFeaturedIds={heroFeaturedIds}
    />
  );
}
