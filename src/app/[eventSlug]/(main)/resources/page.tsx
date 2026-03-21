import { notFound, redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { ExternalLink, Download, Code, MessageSquare, Users } from "lucide-react";
import { ResourcesEggTrigger } from "@/components/easter/ResourcesEggTrigger";

interface ResourcesPageProps {
  params: Promise<{ eventSlug: string }>;
}

const resources = [
  {
    id: "1",
    category: "Getting Started",
    items: [
      { title: "Download Cursor", description: "Get the AI-powered code editor", url: "https://cursor.com/download", icon: Download },
      { title: "Cursor Documentation", description: "Learn how to use Cursor effectively", url: "https://docs.cursor.com", icon: Code },
    ],
  },
  {
    id: "2",
    category: "Community",
    items: [
      { title: "Cursor Discord", description: "Join the community chat", url: "https://discord.gg/cursor", icon: MessageSquare },
      { title: "Cursor Forum", description: "Ask questions and share tips", url: "https://forum.cursor.com", icon: Users },
    ],
  },
];

export default async function ResourcesPage({ params }: ResourcesPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    notFound();
  }

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const intakeStatus = await getIntakeStatus(event.id, session.userId);
  if (!intakeStatus.completed && !intakeStatus.skipped) {
    redirect(`/${eventSlug}/intake`);
  }

  return (
    <main className="max-w-lg mx-auto w-full px-6 py-12 space-y-12">
      <div className="animate-fade-in space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
          Knowledge
        </p>
        <h1 className="text-4xl font-light text-white tracking-tight">
          Resources
        </h1>
      </div>

      {resources.map((category, catIndex) => (
        <div key={category.id} className="space-y-6 animate-slide-up" style={{ animationDelay: `${catIndex * 100}ms` }}>
          <div className="flex items-center gap-4 px-2">
            <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
              {category.category}
            </p>
            <div className="h-[1px] flex-1 bg-white/[0.03]" />
          </div>

          <div className="space-y-4">
            {category.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <a
                  key={index}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="glass rounded-[32px] p-6 flex items-center gap-6 transition-all duration-500 hover:bg-white/[0.03] hover:border-white/10 hover:translate-x-1 border-white/[0.03] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3 text-white/40" />
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.02)]">
                      <Icon className="w-6 h-6 stroke-[1.5px] opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-light text-white tracking-tight">{item.title}</h3>
                      <p className="text-xs text-gray-600 font-light mt-1 tracking-wide">{item.description}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ))}

      <ResourcesEggTrigger eventSlug={eventSlug} />
    </main>
  );
}
