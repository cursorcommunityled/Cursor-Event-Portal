import { redirect } from "next/navigation";

interface DemoPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function DemosPage({ params }: DemoPageProps) {
  const { eventSlug } = await params;
  redirect(`/${eventSlug}/sessions`);
}
