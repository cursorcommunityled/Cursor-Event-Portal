import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ eventSlug: string }>;
}

export default async function SocialsHelpPage({ params }: Props) {
  const { eventSlug } = await params;
  redirect(`/${eventSlug}/socials/qa?view=help`);
}
