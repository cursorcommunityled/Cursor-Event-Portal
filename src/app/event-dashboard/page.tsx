import { notFound, redirect } from "next/navigation";
import { getActiveEventSlug, getEventBySlug } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EventDashboardRedirectPage() {
  const activeSlug = await getActiveEventSlug();
  if (!activeSlug) notFound();

  const event = await getEventBySlug(activeSlug);
  if (!event) notFound();

  redirect(`/${event.slug}`);
}
