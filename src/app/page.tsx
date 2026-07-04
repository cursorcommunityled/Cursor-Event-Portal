import { getActiveEventSlug, getEventBySlug, getEventsWithApprovedPhotos, getHeroFeaturedPhotoIds } from "@/lib/supabase/queries";
import LandingPage from "@/components/landing/LandingPage";

export const revalidate = 0;

const liveEventFallbackPath = "/calgary-june-2026";

async function getEventPortalPath() {
  try {
    const activeSlug = await getActiveEventSlug();
    if (!activeSlug) return liveEventFallbackPath;

    const activeEvent = await getEventBySlug(activeSlug);
    return activeEvent ? `/${activeEvent.slug}` : liveEventFallbackPath;
  } catch (error) {
    console.error("[HomePage] Failed to resolve event portal path:", error);
    return liveEventFallbackPath;
  }
}

export default async function HomePage() {
  const [eventsResult, featuredResult, portalPathResult] = await Promise.allSettled([
    getEventsWithApprovedPhotos(),
    getHeroFeaturedPhotoIds(),
    getEventPortalPath(),
  ]);

  if (eventsResult.status === "rejected") {
    console.error("[HomePage] Failed to load event photos:", eventsResult.reason);
  }

  if (featuredResult.status === "rejected") {
    console.error("[HomePage] Failed to load featured photo settings:", featuredResult.reason);
  }

  const eventsWithPhotos = eventsResult.status === "fulfilled" ? eventsResult.value : [];
  const heroFeaturedIds = featuredResult.status === "fulfilled" ? featuredResult.value : [];
  const eventPortalPath = portalPathResult.status === "fulfilled"
    ? portalPathResult.value
    : liveEventFallbackPath;

  return (
    <LandingPage
      eventsWithPhotos={eventsWithPhotos}
      heroFeaturedIds={heroFeaturedIds}
      eventPortalPath={eventPortalPath}
    />
  );
}
