import { redirect } from "next/navigation";

interface AdminDemosPageProps {
  params: Promise<{ adminCode: string }>;
}

export default async function AdminDemosPage({ params }: AdminDemosPageProps) {
  const { adminCode } = await params;
  redirect(`/admin/${adminCode}/sessions`);
}
