"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MonitorPlay, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";

interface DemoSlotPreview {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  signup_count: number;
  spots_left: number;
  is_full: boolean;
  attendees: { id: string; name: string }[];
}

interface DemoStatusData {
  enabled: boolean;
  availability?: { state: string; is_open: boolean; message: string };
  speakerName?: string | null;
  currentSlot?: DemoSlotPreview | null;
  upcomingSlots?: DemoSlotPreview[];
}

interface DemoStatusBadgeProps {
  eventId: string;
  eventSlug: string;
  timezone: string;
}

export function DemoStatusBadge({ eventId, eventSlug, timezone }: DemoStatusBadgeProps) {
  const [status, setStatus] = useState<DemoStatusData | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`/api/demo-status?eventId=${eventId}`);
        if (res.ok) setStatus(await res.json());
      } catch {
        // silently ignore — badge just won't show
      }
    }
    loadStatus();
    const interval = setInterval(loadStatus, 30_000);
    return () => clearInterval(interval);
  }, [eventId]);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (!status?.enabled || !status.availability) return null;

  const { availability, speakerName, currentSlot, upcomingSlots = [] } = status;

  // Hide entirely if closed with no current slot
  if (availability.state === "closed" && !currentSlot) return null;
  if (availability.state === "disabled") return null;

  const hasOpenSlots = upcomingSlots.some((s) => !s.is_full);
  const isAvailable = availability.is_open && hasOpenSlots;

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-50">
      {/* Pill badge */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3.5 py-2 rounded-2xl border backdrop-blur-xl transition-all duration-300",
          isAvailable
            ? "bg-blue-500/15 border-blue-500/40 hover:bg-blue-500/25 shadow-[0_0_20px_rgba(59,130,246,0.35)]"
            : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
        )}
      >
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            isAvailable
              ? "bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.9)]"
              : "bg-gray-600"
          )}
        />
        <span
          className={cn(
            "text-[10px] uppercase tracking-[0.2em] font-bold whitespace-nowrap",
            isAvailable ? "text-blue-300" : "text-gray-500"
          )}
        >
          {isAvailable ? "Demo Slots Available Now!" : "Demos"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-3 w-72 rounded-[20px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl bg-black/95 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold">
                  Live Demos
                </p>
              </div>
              {speakerName && (
                <p className="text-xs text-gray-500 pl-[22px]">{speakerName}</p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-600 hover:text-gray-400 transition-colors mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Current slot */}
            {currentSlot && (
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.3em] text-green-500 font-bold">
                  Now
                </p>
                <div className="rounded-[14px] bg-green-500/10 border border-green-500/20 px-4 py-3 space-y-1.5">
                  <p className="text-xs text-white font-medium">
                    {formatTime(currentSlot.starts_at, timezone)} –{" "}
                    {formatTime(currentSlot.ends_at, timezone)}
                  </p>
                  {currentSlot.attendees.length > 0 ? (
                    <p className="text-[11px] text-gray-400">
                      {currentSlot.attendees.map((a) => a.name.split(" ")[0]).join(" · ")}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-600">No one booked yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Upcoming slots */}
            {upcomingSlots.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.3em] text-gray-600 font-bold">
                  Up Next
                </p>
                <div className="space-y-2">
                  {upcomingSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs text-gray-400">
                        {formatTime(slot.starts_at, timezone)}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold",
                          slot.is_full
                            ? "text-gray-600"
                            : slot.spots_left === slot.capacity
                            ? "text-green-400"
                            : "text-amber-400"
                        )}
                      >
                        {slot.is_full
                          ? "Full"
                          : slot.spots_left === slot.capacity
                          ? `${slot.spots_left} spots open`
                          : `${slot.spots_left} spot${slot.spots_left !== 1 ? "s" : ""} left`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming state message */}
            {!availability.is_open && availability.state === "upcoming" && (
              <p className="text-[11px] text-gray-600 leading-relaxed">
                {availability.message}
              </p>
            )}

            {/* CTA */}
            <Link
              href={`/${eventSlug}/demos`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[14px] bg-white text-black text-xs font-semibold tracking-tight hover:bg-gray-100 transition-colors"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              Go to Demos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
