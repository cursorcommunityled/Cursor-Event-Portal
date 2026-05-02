import { getEventsWithApprovedPhotos, getHeroFeaturedPhotoIds } from "@/lib/supabase/queries";
import LandingPage from "@/components/landing/LandingPage";

export const revalidate = 0;

export default async function HomePage() {
  const [eventsWithPhotos, heroFeaturedIds] = await Promise.all([
    getEventsWithApprovedPhotos(),
    getHeroFeaturedPhotoIds(),
  ]);
  return (
    <LandingPage
      eventsWithPhotos={eventsWithPhotos}
      heroFeaturedIds={heroFeaturedIds}
    />
  );
}
