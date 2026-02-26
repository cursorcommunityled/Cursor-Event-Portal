"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { formatTime } from "@/lib/utils";
import { updateDemoSignupSettings } from "@/lib/actions/demo";
import type { Event, DemoSignupSettings } from "@/types";
import type { DemoSlotWithCounts } from "@/lib/demo/service";

function utcToLocalDateTime(utcValue: string, timezone: string): string {
  const date = new Date(utcValue);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

interface DemosAdminClientProps {
  event: Event;
  adminCode: string;
  settings: DemoSignupSettings;
  slots: DemoSlotWithCounts[];
}

export function DemosAdminClient({ event, adminCode, settings, slots }: DemosAdminClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const timezone = event.timezone || "America/Edmonton";
  const [isEnabled, setIsEnabled] = useState(settings.is_enabled);
  const [speakerName, setSpeakerName] = useState(settings.speaker_name || "");
  const [opensAtLocal, setOpensAtLocal] = useState(utcToLocalDateTime(settings.opens_at, timezone));
  const [closesAtLocal, setClosesAtLocal] = useState(utcToLocalDateTime(settings.closes_at, timezone));

  const totalBookings = slots.reduce((acc, slot) => acc + slot.signup_count, 0);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateDemoSignupSettings(event.id, event.slug, adminCode, {
        isEnabled,
        speakerName,
        opensAtLocal,
        closesAtLocal,
        timezone,
      });

      if (!result.success) {
        setError(result.error || "Failed to save demo settings");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col">
      <AdminHeader adminCode={adminCode} subtitle="Demo Signup" />
      <main className="max-w-4xl mx-auto px-6 py-8 pb-16 w-full space-y-8 flex-1">
        <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-light tracking-tight">Demo Settings</h2>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              Enabled
            </label>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Speaker</label>
              <input
                type="text"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                placeholder="Optional speaker name"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Opens At</label>
              <input
                type="datetime-local"
                value={opensAtLocal}
                onChange={(e) => setOpensAtLocal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Closes At</label>
              <input
                type="datetime-local"
                value={closesAtLocal}
                onChange={(e) => setClosesAtLocal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={isPending}
            className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40"
          >
            {isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>

        <div className="glass rounded-[32px] p-8 border-white/10 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-light tracking-tight">Slot Occupancy</h3>
              <p className="text-sm text-gray-500 mt-1">{slots.length} slots · {totalBookings} total bookings</p>
            </div>
          </div>

          <div className="space-y-3">
            {slots.map((slot) => (
              <div key={slot.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-white">
                    {formatTime(slot.starts_at, timezone)} - {formatTime(slot.ends_at, timezone)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {slot.signup_count}/{slot.capacity} booked
                  </p>
                </div>
                {slot.attendees.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {slot.attendees.map((attendee) => (
                      <span
                        key={attendee.id}
                        className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-300 border border-white/10"
                      >
                        {attendee.name} {attendee.email ? `(${attendee.email})` : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-600">No attendees booked.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
