"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setActiveEventSlug } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";
import type { EventSummary } from "@/lib/supabase/queries";

interface AdminEventControlsProps {
  events: EventSummary[];
  currentAdminCode: string;
  activeSlug: string;
}

function eventLabel(ev: EventSummary) {
  if (!ev.start_time) return ev.name;
  return new Date(ev.start_time).toLocaleDateString("en-CA", {
    timeZone: "America/Edmonton",
    month: "short",
    day: "numeric",
  });
}

export function AdminEventControls({ events, currentAdminCode, activeSlug }: AdminEventControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (events.length <= 1) return null;

  return (
    <div className="glass rounded-[32px] px-6 py-5 border-white/[0.08] animate-slide-up" style={{ animationDelay: "100ms" }}>
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        {/* Admin view switcher */}
        <div className="flex items-center gap-3">
          <span className="text-[9px] uppercase tracking-[0.3em] text-gray-600 font-medium whitespace-nowrap">Admin View</span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
            {events.map((ev) => {
              if (!ev.admin_code) return null;
              const isCurrent = ev.admin_code === currentAdminCode;
              return (
                <button
                  key={ev.id}
                  onClick={() => { if (!isCurrent) router.push(`/admin/${ev.admin_code}`); }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-medium tracking-wide transition-all duration-200",
                    isCurrent
                      ? "bg-white text-black shadow-[0_1px_8px_rgba(255,255,255,0.15)]"
                      : "text-gray-500 hover:text-white/70 cursor-pointer"
                  )}
                >
                  {eventLabel(ev)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live event switcher */}
        <div className="flex items-center gap-3">
          <span className="text-[9px] uppercase tracking-[0.3em] text-gray-600 font-medium whitespace-nowrap">Live Event</span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
            {events.map((ev) => {
              const isLive = ev.slug === activeSlug;
              return (
                <button
                  key={ev.id}
                  disabled={isPending || isLive}
                  onClick={() => {
                    if (!isLive) {
                      startTransition(async () => {
                        await setActiveEventSlug(ev.slug);
                      });
                    }
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-medium tracking-wide transition-all duration-200 disabled:opacity-60",
                    isLive
                      ? "bg-white text-black shadow-[0_1px_8px_rgba(255,255,255,0.15)]"
                      : "text-gray-500 hover:text-white/70 cursor-pointer"
                  )}
                >
                  {eventLabel(ev)}
                </button>
              );
            })}
          </div>
          {isPending && <span className="text-[9px] text-gray-600 uppercase tracking-widest">Updating…</span>}
        </div>
      </div>
    </div>
  );
}
