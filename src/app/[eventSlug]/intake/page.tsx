import { redirect } from "next/navigation";

interface IntakePageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function IntakePage({ params }: IntakePageProps) {
  const { eventSlug } = await params;
  redirect(`/${eventSlug}/agenda`);
}
