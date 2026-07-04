import { redirect } from "next/navigation";
import { getActiveEventSlug } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EventDashboardRedirectPage() {
  const activeSlug = await getActiveEventSlug();
  if (!activeSlug) redirect("/");

  redirect(`/${activeSlug}`);
}
