import { notFound, redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { DataClient } from "@/components/data/DataClient";

interface DataPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function DataPage({ params }: DataPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();
  if (!event.is_hackathon) notFound();

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  return (
    <main className="max-w-5xl mx-auto w-full px-6 py-12 space-y-10 min-w-0">
      <div className="animate-fade-in space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
          Hackathon
        </p>
        <h1 className="text-4xl font-light text-white tracking-tight">Data</h1>
        <p className="text-sm text-gray-500 max-w-2xl">
          Anonymized financial datasets for building tonight. Preview in-browser, then download CSV
          or XLSX.
        </p>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <DataClient />
      </div>
    </main>
  );
}
