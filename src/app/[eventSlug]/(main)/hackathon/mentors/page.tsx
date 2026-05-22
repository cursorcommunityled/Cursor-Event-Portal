import { notFound, redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ eventSlug: string }>;
}

export default async function HackathonMentorsPage({ params }: Props) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();
  if (!event.is_hackathon) redirect(`/${eventSlug}/hackathon`);

  redirect(`/${eventSlug}/hackathon#mentors`);
}
