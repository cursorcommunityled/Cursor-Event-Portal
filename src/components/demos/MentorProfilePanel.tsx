"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, UserCheck, Video } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { bookDemoSlot, cancelMyDemoSlot } from "@/lib/actions/demo";
import type { DemoAvailability, DemoSlotWithCounts } from "@/lib/demo/service";
import type { Mentor } from "@/types";

const MEET_LINK_UNLOCK_EARLY_MS = 0;
const MEET_LINK_UNLOCK_LATE_MS = 10 * 60 * 1000;

interface MentorProfilePanelProps {
  eventSlug: string;
  timezone: string;
  mentor: Mentor;
  slots: DemoSlotWithCounts[];
  availability: DemoAvailability;
  mySlotId: string | null;
}

export function MentorProfilePanel({
  eventSlug,
  timezone,
  mentor,
  slots,
  availability,
  mySlotId,
}: MentorProfilePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleBook = (slotId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await bookDemoSlot(eventSlug, slotId);
      if (!result.success) {
        setError(result.error || "Failed to book session.");
        return;
      }
      router.refresh();
    });
  };

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelMyDemoSlot(eventSlug);
      if (!result.success) {
        setError(result.error || "Failed to cancel session.");
        return;
      }
      router.refresh();
    });
  };

  const mySlot = slots.find((s) => s.id === mySlotId) || null;
  const mentorshipMode = mentor.mentorship_mode || "virtual";
  const isInPerson = mentorshipMode === "in_person" || mentorshipMode === "hybrid";
  const canBookSlots = mentorshipMode !== "in_person";
  const showBookingControls = canBookSlots && slots.length > 0;
  const canInteract = availability.is_open && canBookSlots;
  const meetLinkUnlocked = mySlot
    ? now >= new Date(mySlot.starts_at).getTime() - MEET_LINK_UNLOCK_EARLY_MS
      && now <= new Date(mySlot.ends_at).getTime() + MEET_LINK_UNLOCK_LATE_MS
    : false;

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="glass rounded-[32px] p-6 border-white/10 space-y-5">
        <div className="flex items-start gap-5">
          {mentor.photo_url ? (
            <img
              src={mentor.photo_url}
              alt={mentor.name}
              className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-3xl font-light text-white flex-shrink-0">
              {mentor.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-lg font-medium text-white">{mentor.name}</p>
            {mentor.title && <p className="text-sm text-gray-400 mt-0.5">{mentor.title}</p>}
            {mentor.company && <p className="text-xs text-gray-500 mt-0.5">{mentor.company}</p>}
          </div>
        </div>

        {mentor.bio && (
          <p className="text-sm text-gray-400 leading-relaxed">{mentor.bio}</p>
        )}

        {isInPerson && (mentor.in_person_schedule || mentor.in_person_location) && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">In-Person Mentoring</p>
            {mentor.in_person_schedule && (
              <div className="flex gap-3 text-sm text-gray-300">
                <Clock className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
                <p>{mentor.in_person_schedule}</p>
              </div>
            )}
            {mentor.in_person_location && (
              <div className="flex gap-3 text-sm text-gray-300">
                <MapPin className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
                <p>{mentor.in_person_location}</p>
              </div>
            )}
          </div>
        )}

        {mySlot && mentor.meet_link && meetLinkUnlocked && (
          <a
            href={mentor.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 h-11 px-5 rounded-2xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-all"
          >
            <Video className="w-4 h-4" />
            Join Google Meet
          </a>
        )}

        {mySlot && mentor.meet_link && !meetLinkUnlocked && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-200">
            Google Meet link unlocks at {formatTime(mySlot.starts_at, timezone)}.
          </div>
        )}
      </div>

      {/* Booking confirmation */}
      {mySlot && (
        <div className="glass rounded-[24px] p-4 border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-sm text-white">
              You&apos;re booked at{" "}
              <span className="font-medium">
                {formatTime(mySlot.starts_at, timezone)} – {formatTime(mySlot.ends_at, timezone)}
              </span>
            </p>
          </div>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="h-9 px-4 rounded-2xl border border-white/15 text-xs uppercase tracking-[0.15em] text-gray-300 hover:text-red-300 hover:border-red-500/30 transition-all disabled:opacity-40 shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="glass rounded-[24px] p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Availability message */}
      {showBookingControls && (
        <div className="glass rounded-[24px] p-4 border-white/10">
          <p className="text-xs text-gray-500">{availability.message}</p>
        </div>
      )}

      {/* Slots */}
      <div className="space-y-3">
        {slots.length === 0 && (
          <div className="glass rounded-[24px] p-6 border-white/10 text-sm text-gray-500 text-center">
            {isInPerson
              ? "No booking needed. Check the in-person schedule above to find this mentor during the hackathon."
              : "No sessions scheduled with this mentor yet."}
          </div>
        )}
        {slots.map((slot) => {
          const isMine = mySlotId === slot.id;
          const isBlockedByExisting = !!mySlotId && !isMine;
          const isDisabled = !canInteract || slot.is_full || isBlockedByExisting || isPending;

          return (
            <div key={slot.id} className="glass rounded-[24px] p-5 border-white/10 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">{slot.title || "Mentor Session"}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-600" />
                    {formatTime(slot.starts_at, timezone)} – {formatTime(slot.ends_at, timezone)}
                  </span>
                  {slot.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-600" />
                      {slot.location}
                    </span>
                  )}
                </div>
                {slot.description && (
                  <p className="text-xs text-gray-500 mt-2 max-w-md">{slot.description}</p>
                )}
                {canBookSlots && (
                  <p className="text-xs text-gray-600 mt-2">
                    {slot.signup_count}/{slot.capacity} booked
                    {slot.is_full ? " (full)" : ` (${slot.spots_left} left)`}
                  </p>
                )}
              </div>
              {canBookSlots && (
                isMine ? (
                  <button
                    onClick={handleCancel}
                    disabled={isPending}
                    className="h-10 px-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] font-bold transition-all bg-white/10 text-gray-300 border border-white/20 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 disabled:opacity-40 shrink-0"
                  >
                    Unbook
                  </button>
                ) : (
                  <button
                    onClick={() => handleBook(slot.id)}
                    disabled={isDisabled}
                    className="h-10 px-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] font-bold transition-all bg-white text-black hover:bg-gray-200 disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
                  >
                    Book
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
