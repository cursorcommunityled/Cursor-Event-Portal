"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { formatDate } from "@/lib/utils";
import type { TopCheckedInGuest } from "@/lib/supabase/queries";

const PAGE_SIZE = 10;
const MAX_VISIBLE = 30;

export const REGULARS_PAGE_SIZE = PAGE_SIZE;
export const REGULARS_MAX_VISIBLE = MAX_VISIBLE;

interface RegularsClientProps {
  adminCode: string;
  guests: TopCheckedInGuest[];
}

export function RegularsClient({ adminCode, guests }: RegularsClientProps) {
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader
        adminCode={adminCode}
        subtitle="Regulars"
        showBackArrow={true}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 w-full z-10 flex-1 space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-light tracking-tight text-white/90">Most events attended</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
            Ranked by venue check-ins across all events
          </p>
        </div>

        <RegularsList
          guests={guests}
          openUserId={openUserId}
          onToggle={(userId) => setOpenUserId((current) => (current === userId ? null : userId))}
        />
      </main>

      <footer className="py-12 px-6 border-t border-white/20 flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Regulars</p>
      </footer>
    </div>
  );
}

export function RegularsList({
  guests,
  openUserId,
  onToggle,
}: {
  guests: TopCheckedInGuest[];
  openUserId?: string | null;
  onToggle?: (userId: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (guests.length === 0) {
    return (
      <div className="glass rounded-[40px] p-10 border-white/20 text-center">
        <p className="text-sm text-gray-500">No checked-in guests yet</p>
      </div>
    );
  }

  const cappedGuests = guests.slice(0, MAX_VISIBLE);
  const visibleGuests = cappedGuests.slice(0, visibleCount);
  const remaining = cappedGuests.length - visibleGuests.length;
  const nextCount = Math.min(PAGE_SIZE, remaining);

  return (
    <div className="glass rounded-[40px] p-8 md:p-10 border-white/20 space-y-1">
      {visibleGuests.map((guest, index) => {
        const isOpen = openUserId === guest.userId;
        const label = `${guest.name} (${guest.eventCount})`;

        return (
          <div key={guest.userId} className="border-b border-white/[0.06] last:border-b-0">
            <button
              type="button"
              onClick={() => onToggle?.(guest.userId)}
              className="w-full flex items-baseline gap-4 py-4 text-left hover:bg-white/[0.03] transition-colors rounded-xl px-2 -mx-2"
            >
              <span className="w-8 shrink-0 text-[11px] tabular-nums text-gray-600">
                {index + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-base font-light tracking-tight text-white/90">{label}</span>
                {guest.email && (
                  <span className="block text-[11px] text-gray-600 mt-1 truncate">{guest.email}</span>
                )}
              </span>
            </button>
            {isOpen && guest.events.length > 0 && (
              <ul className="pb-4 pl-14 space-y-1.5">
                {guest.events.map((event) => (
                  <li key={event.id} className="text-sm text-gray-400 font-light">
                    {event.name}
                    {event.startTime && (
                      <span className="text-gray-600">
                        {" "}
                        · {formatDate(event.startTime)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {nextCount > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, MAX_VISIBLE))}
          className="w-full pt-5 pb-1 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium hover:text-white/70 transition-colors"
        >
          Show next {nextCount}
        </button>
      )}
    </div>
  );
}
