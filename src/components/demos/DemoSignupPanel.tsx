"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, UserCheck } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { bookDemoSlot, cancelMyDemoSlot } from "@/lib/actions/demo";
import type { DemoAvailability, DemoSlotWithCounts } from "@/lib/demo/service";

interface DemoSignupPanelProps {
  eventSlug: string;
  timezone: string;
  availability: DemoAvailability;
  speakerName: string | null;
  slots: DemoSlotWithCounts[];
  mySlotId: string | null;
}

export function DemoSignupPanel({
  eventSlug,
  timezone,
  availability,
  speakerName,
  slots,
  mySlotId,
}: DemoSignupPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleBook = (slotId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await bookDemoSlot(eventSlug, slotId);
      if (!result.success) {
        setError(result.error || "Failed to book demo slot.");
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
        setError(result.error || "Failed to cancel demo slot.");
        return;
      }
      router.refresh();
    });
  };

  const mySlot = slots.find((slot) => slot.id === mySlotId) || null;
  const canInteract = availability.is_open;

  return (
    <div className="space-y-6">
      <div className="glass rounded-[32px] p-6 border-white/10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              Demo Signup Window
            </p>
            <p className="text-sm text-gray-300 mt-1">{availability.message}</p>
            {speakerName && (
              <p className="text-xs text-gray-500 mt-2">Speaker: {speakerName}</p>
            )}
          </div>
          {mySlot && (
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="h-10 px-4 rounded-2xl border border-white/15 text-xs uppercase tracking-[0.15em] text-gray-300 hover:text-white hover:border-white/30 transition-all disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>
        {mySlot && (
          <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <UserCheck className="w-4 h-4 text-green-400" />
            <p className="text-sm text-white">
              You booked{" "}
              {formatTime(mySlot.starts_at, timezone)} - {formatTime(mySlot.ends_at, timezone)}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="glass rounded-[24px] p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {slots.map((slot) => {
          const isMine = mySlotId === slot.id;
          const isBlockedByExisting = !!mySlotId && !isMine;
          const isDisabled = !canInteract || slot.is_full || isBlockedByExisting || isPending;
          return (
            <div key={slot.id} className="glass rounded-[24px] p-5 border-white/10 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-white">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">
                    {formatTime(slot.starts_at, timezone)} - {formatTime(slot.ends_at, timezone)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {slot.signup_count}/{slot.capacity} booked
                  {slot.is_full ? " (full)" : ` (${slot.spots_left} left)`}
                </p>
              </div>
              <button
                onClick={() => handleBook(slot.id)}
                disabled={isDisabled || isMine}
                className={`h-10 px-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${
                  isMine
                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : "bg-white text-black hover:bg-gray-200 disabled:opacity-35 disabled:cursor-not-allowed"
                }`}
              >
                {isMine ? "Booked" : "Book"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
