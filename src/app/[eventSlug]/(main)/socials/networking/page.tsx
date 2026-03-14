import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ eventSlug: string }>;
}

export default async function SocialsNetworkingPage({ params }: Props) {
  const { eventSlug } = await params;
  redirect(`/${eventSlug}/socials/exchange?view=networking`);
}
