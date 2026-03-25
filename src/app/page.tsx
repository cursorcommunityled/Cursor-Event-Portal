import { getActiveEventSlug } from "@/lib/supabase/queries";
import LandingPage from "@/components/landing/LandingPage";

export const revalidate = 0;

export default async function HomePage() {
  const activeSlug = await getActiveEventSlug();
  return <LandingPage activeEventSlug={activeSlug} />;
}
