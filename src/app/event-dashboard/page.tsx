import { redirect } from "next/navigation";
import { getActiveEventSlug, getEventBySlug } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const liveEventFallbackPath = "/calgary-june-2026";

export default async function EventDashboardRedirectPage() {
  const activeSlug = await getActiveEventSlug();
  if (!activeSlug) redirect(liveEventFallbackPath);

  const event = await getEventBySlug(activeSlug);
  if (!event) redirect(liveEventFallbackPath);

  redirect(`/${event.slug}`);
}
