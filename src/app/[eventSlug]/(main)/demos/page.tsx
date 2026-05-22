import { redirect } from "next/navigation";
import { SESSIONS_PAGE_ENABLED } from "@/lib/demo/visibility";

interface DemoPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function DemosPage({ params }: DemoPageProps) {
  const { eventSlug } = await params;
  if (!SESSIONS_PAGE_ENABLED) redirect(`/${eventSlug}/agenda`);
  redirect(`/${eventSlug}/sessions`);
}
