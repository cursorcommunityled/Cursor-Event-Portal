import {
  getActiveEventSlug,
  getEventsWithApprovedPhotos,
  getHeroFeaturedPhotoIds,
  getLandingEvents,
} from "@/lib/supabase/queries";
import { mergeLandingEvents } from "@/lib/landing-events";
import LandingPage from "@/components/landing/LandingPage";

export const revalidate = 0;

async function getEventPortalPath() {
  try {
    const activeSlug = await getActiveEventSlug();
    return activeSlug ? `/${activeSlug}` : "/";
  } catch (error) {
    console.error("[HomePage] Failed to resolve event portal path:", error);
    return "/";
  }
}

export default async function HomePage() {
  const [eventsResult, featuredResult, portalPathResult, landingResult] = await Promise.allSettled([
    getEventsWithApprovedPhotos(),
    getHeroFeaturedPhotoIds(),
    getEventPortalPath(),
    getLandingEvents(),
  ]);

  if (eventsResult.status === "rejected") {
    console.error("[HomePage] Failed to load event photos:", eventsResult.reason);
  }

  if (featuredResult.status === "rejected") {
    console.error("[HomePage] Failed to load featured photo settings:", featuredResult.reason);
  }

  if (landingResult.status === "rejected") {
    console.error("[HomePage] Failed to load landing events:", landingResult.reason);
  }

  const eventsWithPhotos = eventsResult.status === "fulfilled" ? eventsResult.value : [];
  const heroFeaturedIds = featuredResult.status === "fulfilled" ? featuredResult.value : [];
  const eventPortalPath = portalPathResult.status === "fulfilled"
    ? portalPathResult.value
    : "/";
  const landingEvents = landingResult.status === "fulfilled"
    ? landingResult.value
    : mergeLandingEvents([]);

  return (
    <LandingPage
      eventsWithPhotos={eventsWithPhotos}
      heroFeaturedIds={heroFeaturedIds}
      eventPortalPath={eventPortalPath}
      landingEvents={landingEvents}
    />
  );
}
