"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatTime, isNow, isNext } from "@/lib/utils";
import type { AgendaItem } from "@/types";
import { MapPin, User, X, ChevronRight, Clock } from "lucide-react";
import { AgendaItemTimer } from "@/components/timer/AgendaItemTimer";
import { createClient } from "@/lib/supabase/client";

interface AgendaListProps {
  items: AgendaItem[];
  eventId: string;
  eventTimezone?: string;
  eventStartTime?: string | null;
}

interface AgendaItemDetails {
  summary?: string;
  details?: string;
  tips?: string[];
}

// Parse description to extract structured details
function parseDescription(description: string | null): AgendaItemDetails {
  if (!description) return {};

  // Check if description contains structured data (JSON-like format)
  try {
    if (description.startsWith("{")) {
      return JSON.parse(description);
    }
  } catch {
    // Not JSON, use as plain text
  }

  return { summary: description };
}

// Map agenda item titles to images and captions
function getAgendaImage(title: string): { url: string; caption: string } | null {
  const titleLower = title.toLowerCase();

  if (titleLower.includes("arrival") || titleLower.includes("mingle") || titleLower.includes("mingling") || titleLower.includes("check-in") || titleLower.includes("checkin")) {
    return { url: "/agenda-mingling.png", caption: "Connect with fellow attendees" };
  }
  // Specific swap: \"Networking and Judging\" should use the Wind-Down image
  if (titleLower.includes("networking and judging")) {
    return { url: "/blitz2.png", caption: "Networking while judges deliberate" };
  }
  // Specific image for Build Showcase session
  if (titleLower.includes("build showcase")) {
    return { url: "/showcase.png", caption: "Build showcase and community voting" };
  }
  if (titleLower.includes("intro") || titleLower.includes("welcome") || titleLower.includes("opening")) {
    return { url: "/agenda-intro.png", caption: "Setting the stage" };
  }
  if (titleLower.includes("demo") || titleLower.includes("showcase") || titleLower.includes("present")) {
    return { url: "/demos-2.png", caption: "Live demonstrations" };
  }
  if (titleLower.includes("network") || titleLower.includes("group") || titleLower.includes("connect")) {
    return { url: "/agenda-networking.png", caption: "Build meaningful connections" };
  }
  if (titleLower.includes("build") || titleLower.includes("workshop") || titleLower.includes("hands-on")) {
    return { url: "/agenda-build.png", caption: "Create something amazing" };
  }
  if (titleLower.includes("blitz") || titleLower.includes("lightning") || titleLower.includes("rapid")) {
    return { url: "/blitz2.png", caption: "Quick-fire rounds" };
  }
  // Wind-down sessions now use the networking image, completing the swap
  if (titleLower.includes("wind") || titleLower.includes("wrap") || titleLower.includes("closing") || titleLower.includes("tear")) {
    return { url: "/agenda-networking.png", caption: "Wrapping up and connecting" };
  }

  return null;
}

export function AgendaList({ items: initialItems, eventId, eventTimezone = "America/Edmonton", eventStartTime = null }: AgendaListProps) {
  const router = useRouter();
  const [items, setItems] = useState<AgendaItem[]>(initialItems);
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);

  // Subscribe to real-time agenda updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`agenda-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agenda_items",
          filter: `event_id=eq.${eventId}`,
        },
        async () => {
          // Refresh the page to get updated agenda items
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  // Update items when initialItems changes (from server refresh)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          No agenda items yet. Check back soon!
        </p>
      </div>
    );
  }

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <>
      <div className="space-y-8">
        {items.map((item, index) => {
          const isCurrentlyNow = isNow(item.start_time, item.end_time);
          const isUpNext = isNext(
            item.start_time,
            items.map((i) => ({ start_time: i.start_time, end_time: i.end_time }))
          );
          const hasDetails = item.description || item.speaker || item.location;

          const parsed = parseDescription(item.description);
          const titleLower = item.title.toLowerCase();
          const isBlitz = titleLower.includes("blitz") || titleLower.includes("lightning") || titleLower.includes("rapid");
          const agendaImage = item.image_url
            ? { url: item.image_url, caption: item.title }
            : isBlitz
              ? { url: "/blitz2.png", caption: "Quick-fire rounds" }
              : getAgendaImage(item.title);

          return (
            <div
              key={item.id}
              className={`w-full text-left glass rounded-[40px] p-10 md:p-12 transition-all duration-300 animate-slide-up relative overflow-hidden group shadow-sm ${
                isCurrentlyNow
                  ? "border-white/20 bg-white/[0.06] shadow-glow"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:shadow-glow-lg hover:border-white/10"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {isCurrentlyNow && (
                <div className="absolute top-0 right-0 p-6 md:p-7 z-30">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-white/70 font-medium">Live</span>
                    <div className="w-3 h-3 rounded-full bg-white animate-pulse shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                  </div>
                </div>
              )}

              <div className="relative z-20 space-y-5 md:space-y-6 max-w-full md:max-w-[65%] transition-all duration-500">
                {/* Time and Duration Row */}
                <div className="flex items-center gap-5 md:gap-6 flex-wrap">
                  <div className={`text-[13px] md:text-[14px] font-semibold uppercase tracking-[0.2em] ${
                    isCurrentlyNow
                      ? "text-white"
                      : isUpNext
                        ? "text-gray-300"
                        : "text-gray-500"
                  }`}>
                    {isCurrentlyNow ? "Happening Now" : isUpNext ? "Up Next" : formatTime(item.start_time || "", eventTimezone)}
                  </div>
                  {item.start_time && item.end_time && !isCurrentlyNow && (
                    <div className="text-[12px] text-gray-600 font-medium px-3 py-1 rounded-full bg-white/5">
                      {formatDuration(item.start_time, item.end_time)}
                    </div>
                  )}
                  {item.start_time && item.end_time && (
                    <AgendaItemTimer startTime={item.start_time} endTime={item.end_time} eventStartTime={eventStartTime} />
                  )}
                </div>

                {/* Title - Larger */}
                <h3 className="text-3xl md:text-4xl font-light text-white tracking-tight leading-tight">
                  {item.title}
                </h3>

                {/* Description - Always visible */}
                {parsed.summary && (
                  <p className="text-base md:text-lg text-gray-400 font-light leading-relaxed">
                    {parsed.summary}
                  </p>
                )}

                {/* Speaker and Location Row */}
                <div className="flex items-center gap-5 md:gap-6 flex-wrap pt-3">
                  {item.speaker && (
                    <div className="flex items-center gap-2.5">
                      <User className="w-5 h-5 text-gray-600" />
                      <span className="text-[12px] md:text-[13px] font-medium text-gray-400 uppercase tracking-[0.1em]">
                        {item.speaker}
                      </span>
                    </div>
                  )}
                  {item.location && (
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-5 h-5 text-gray-600" />
                      <span className="text-[12px] md:text-[13px] font-medium text-gray-400 uppercase tracking-[0.1em]">
                        {item.location}
                      </span>
                    </div>
                  )}
                </div>

                {/* View Details Button - only if there are additional details */}
                {(parsed.details || parsed.tips) && (
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="mt-3 md:mt-4 inline-flex items-center gap-2.5 text-[12px] md:text-[13px] font-medium text-gray-500 hover:text-white uppercase tracking-[0.15em] transition-colors group/btn"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>

              {/* Hover Image Preview */}
              {agendaImage && (
                <div className="absolute inset-y-0 right-0 w-full md:w-[40%] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-500 pointer-events-none overflow-hidden z-0">
                  <div className="relative w-full h-full">
                    <img
                      src={agendaImage.url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading={item.image_url ? "lazy" : "eager"}
                    />
                    {/* Gradient to blend with card content */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent z-0" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedItem(null)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          <div
            className="relative w-full sm:max-w-md mx-auto bg-[#0a0a0a] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-8 animate-slide-up max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            <div className="space-y-6">
              {/* Time badge */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.15em]">
                    {formatTime(selectedItem.start_time || "", eventTimezone)}
                    {selectedItem.end_time && ` – ${formatTime(selectedItem.end_time, eventTimezone)}`}
                  </span>
                </div>
                {formatDuration(selectedItem.start_time, selectedItem.end_time) && (
                  <span className="text-[10px] text-gray-600">
                    {formatDuration(selectedItem.start_time, selectedItem.end_time)}
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="text-2xl font-light text-white tracking-tight pr-8">
                {selectedItem.title}
              </h2>

              {/* Description / Details */}
              {selectedItem.description && (() => {
                const parsed = parseDescription(selectedItem.description);
                return (
                  <div className="space-y-4">
                    {parsed.summary && (
                      <p className="text-sm text-gray-400 font-light leading-relaxed">
                        {parsed.summary}
                      </p>
                    )}
                    {parsed.details && (
                      <p className="text-sm text-gray-500 font-light leading-relaxed">
                        {parsed.details}
                      </p>
                    )}
                    {parsed.tips && parsed.tips.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                          Tips
                        </p>
                        <ul className="space-y-1.5">
                          {parsed.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                              <span className="text-gray-700 mt-1">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Location */}
              {selectedItem.location && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                      Location
                    </p>
                    <p className="text-sm text-gray-400">
                      {selectedItem.location}
                    </p>
                  </div>
                </div>
              )}

              {/* Speaker */}
              {selectedItem.speaker && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                      Host
                    </p>
                    <p className="text-sm text-gray-400">
                      {selectedItem.speaker}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
