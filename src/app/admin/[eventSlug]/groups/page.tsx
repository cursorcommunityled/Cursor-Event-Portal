import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getEventIntakes, getSuggestedGroups } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { createClient } from "@/lib/supabase/server";
import { GroupFormation } from "@/components/admin/GroupFormationView";
import { AdminHeader } from "@/components/admin/AdminHeader";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

// Force dynamic rendering to always show fresh checked-in data
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AdminGroupsPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function AdminGroupsPage({ params }: AdminGroupsPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    notFound();
  }

  // Verify admin access
  const session = await getSession();
  if (!session) {
    redirect(`/${eventSlug}`);
  }

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    redirect(`/${eventSlug}/agenda`);
  }

  // Redirect to new admin URL format with adminCode
  if (event.admin_code) {
    redirect(`/admin/${eventSlug}/${event.admin_code}/groups`);
  }

  const [intakes, groups] = await Promise.all([
    getEventIntakes(event.id),
    getSuggestedGroups(event.id),
  ]);

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      {/* Subtle Depth Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/[0.02] rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader 
        eventSlug={eventSlug} 
        subtitle="Seating" 
      />

      <main className="max-w-4xl mx-auto px-6 py-8 w-full z-10 flex-1">
        <GroupFormation
          eventId={event.id}
          eventSlug={eventSlug}
          intakes={intakes}
          groups={groups}
        />
      </main>

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <div className="flex items-center gap-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Seating</p>
        </div>
      </footer>
    </div>
  );
}
