import { RegularsClient } from "@/app/admin/_clients/[adminCode]/regulars/RegularsClient";
import { getTopCheckedInGuests } from "@/lib/supabase/queries";
import { getEventForAdmin } from "@/lib/utils/admin";

export const revalidate = 0;

interface RegularsPageProps {
  params: Promise<{ adminCode: string }>;
}

export default async function RegularsPage({ params }: RegularsPageProps) {
  const { adminCode } = await params;
  await getEventForAdmin(adminCode);

  const guests = await getTopCheckedInGuests(30);

  return <RegularsClient adminCode={adminCode} guests={guests} />;
}
