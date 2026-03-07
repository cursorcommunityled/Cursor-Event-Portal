import { AdminHeader } from "@/components/admin/AdminHeader";
import { getEventForAdmin } from "@/lib/utils/admin";
import {
  getNetworkingSession,
  getNetworkingCurrentRound,
  getNetworkingPairsForRound,
} from "@/lib/supabase/queries";
import { NetworkingAdminClient } from "@/app/admin/_clients/networking/NetworkingAdminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminNetworkingPage({
  params,
}: {
  params: Promise<{ adminCode: string }>;
}) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);

  const session = await getNetworkingSession(event.id);
  const round = session ? await getNetworkingCurrentRound(session.id) : null;
  const pairs = round ? await getNetworkingPairsForRound(round.id) : [];

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/[0.02] rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader adminCode={adminCode} subtitle="Speed Networking" />

      <main className="max-w-6xl mx-auto px-6 py-8 w-full z-10 flex-1">
        <NetworkingAdminClient
          eventId={event.id}
          adminCode={adminCode}
          initialSession={session}
          initialRound={round}
          initialPairs={pairs}
        />
      </main>

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Speed Networking</p>
      </footer>
    </div>
  );
}
