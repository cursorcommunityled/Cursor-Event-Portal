import { getActiveEventSlug, getEventsWithApprovedPhotos } from "@/lib/supabase/queries";
import LandingPage from "@/components/landing/LandingPage";

export const revalidate = 0;

export default async function HomePage() {
  const [activeSlug, eventsWithPhotos] = await Promise.all([
    getActiveEventSlug(),
    getEventsWithApprovedPhotos(),
  ]);
  return <LandingPage activeEventSlug={activeSlug} eventsWithPhotos={eventsWithPhotos} />;
}
