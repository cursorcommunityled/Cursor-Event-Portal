"use client";

import { useTransition } from "react";
import { setActiveEventSlug } from "@/lib/actions/settings";
import { MapPin } from "lucide-react";

type EventOption = {
  id: string;
  slug: string;
  name: string;
  venue: string | null;
  start_time: string | null;
  status: string;
  themeTitle?: string | null;
};

interface ActiveVenueSelectorProps {
  events: EventOption[];
  activeSlug: string;
}

export function ActiveVenueSelector({ events, activeSlug }: ActiveVenueSelectorProps) {
  const [isPending, startTransition] = useTransition();

  if (events.length <= 1) return null;

  return (
    <div className="glass rounded-[40px] p-6 border-white/20 animate-slide-up shadow-lg" style={{ animationDelay: "100ms" }}>
      <h3 className="text-[11px] uppercase tracking-[0.4em] text-gray-400 font-medium mb-3 flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5" />
        Active venue (attendee side)
      </h3>
      <p className="text-[10px] text-gray-500 mb-4">
        The homepage &quot;Event Dashboard&quot; button sends attendees to this event. Change it to switch which venue is live.
      </p>
      <div className="flex flex-wrap gap-2">
        {events.map((ev) => {
          const isActive = ev.slug === activeSlug;
          return (
            <button
              key={ev.id}
              type="button"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await setActiveEventSlug(ev.slug);
                });
              }}
              className={`rounded-2xl px-4 py-2.5 text-left transition-all border text-[10px] uppercase tracking-[0.15em] font-medium disabled:opacity-50 ${
                isActive
                  ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  : "bg-white/5 text-white/80 border-white/20 hover:bg-white/10 hover:border-white/30"
              }`}
            >
              <span className="block font-semibold">
                {ev.start_time
                  ? new Date(ev.start_time).toLocaleDateString("en-CA", {
                      timeZone: "America/Edmonton",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : ev.name}
              </span>
              <span className="block opacity-70 mt-0.5">{ev.venue || "Venue TBD"}</span>
              {ev.themeTitle && (
                <span className="block opacity-50 mt-0.5 normal-case tracking-normal text-[9px]">
                  {ev.themeTitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {isPending && <p className="text-[10px] text-gray-500 mt-2">Updating…</p>}
    </div>
  );
}
