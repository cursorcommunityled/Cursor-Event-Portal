"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Confetti } from "@/components/competitions/Confetti";
import { X } from "lucide-react";

export const PIZZA_ALARM_CHANNEL = (eventId: string) => `event-pizza-${eventId}`;
export const PIZZA_ALARM_EVENT = "pizza_alarm";

const ALARM_WINDOW_MS = 60_000;
const OVERLAY_DURATION_MS = 12_000;

interface PizzaAlarmOverlayProps {
  eventId: string;
  initialPizzaAlarmAt?: string | null;
  /** Admin preview — force-show when this timestamp changes */
  previewAt?: string | null;
  /** When false, only render via previewAt (admin page that also broadcasts). */
  listen?: boolean;
}

function PizzaSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="#E8A838" />
      <circle cx="60" cy="60" r="48" fill="#F2C14E" />
      <path
        d="M60 60 L108 60 A48 48 0 0 0 84.97 18.35 Z"
        fill="#E8952A"
        opacity="0.35"
      />
      <path
        d="M60 60 L84.97 18.35 A48 48 0 0 0 35.03 18.35 Z"
        fill="#F0B429"
        opacity="0.4"
      />
      <circle cx="42" cy="40" r="7" fill="#C23B22" />
      <circle cx="72" cy="36" r="6" fill="#C23B22" />
      <circle cx="88" cy="58" r="7" fill="#C23B22" />
      <circle cx="68" cy="78" r="6.5" fill="#C23B22" />
      <circle cx="40" cy="72" r="5.5" fill="#C23B22" />
      <circle cx="55" cy="52" r="4" fill="#3D8B3D" />
      <circle cx="78" cy="66" r="3.5" fill="#3D8B3D" />
      <circle cx="50" cy="88" r="3" fill="#3D8B3D" />
      <line x1="60" y1="12" x2="60" y2="108" stroke="#D4891A" strokeWidth="2" opacity="0.5" />
      <line x1="12" y1="60" x2="108" y2="60" stroke="#D4891A" strokeWidth="2" opacity="0.5" />
      <line x1="26" y1="26" x2="94" y2="94" stroke="#D4891A" strokeWidth="2" opacity="0.45" />
      <line x1="94" y1="26" x2="26" y2="94" stroke="#D4891A" strokeWidth="2" opacity="0.45" />
    </svg>
  );
}

function FallingPizzas() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: 4 + ((i * 7) % 92),
        delay: (i % 7) * 0.18,
        duration: 2.4 + (i % 5) * 0.35,
        size: 28 + (i % 4) * 10,
        rotate: (i % 2 === 0 ? 1 : -1) * (180 + i * 40),
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute pizza-fall"
          style={{
            left: `${p.left}%`,
            top: "-12%",
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--spin" as string]: `${p.rotate}deg`,
          }}
        >
          <PizzaSvg className="h-full w-full drop-shadow-lg" />
        </div>
      ))}
      <style jsx>{`
        .pizza-fall {
          animation-name: pizza-fall-spin;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes pizza-fall-spin {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(var(--spin));
            opacity: 0.85;
          }
        }
      `}</style>
    </div>
  );
}

/** Broadcast pizza alarm to all clients subscribed on the event channel. */
export async function broadcastPizzaAlarm(eventId: string, at: string) {
  const supabase = createClient();
  const channel = supabase.channel(PIZZA_ALARM_CHANNEL(eventId), {
    config: { broadcast: { self: true } },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Realtime subscribe timeout")), 5000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timeout);
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          window.clearTimeout(timeout);
          reject(new Error(`Realtime ${status}`));
        }
      });
    });

    await channel.send({
      type: "broadcast",
      event: PIZZA_ALARM_EVENT,
      payload: { at },
    });
  } finally {
    // Give the send a tick to flush before tearing down.
    await new Promise((r) => setTimeout(r, 150));
    await supabase.removeChannel(channel);
  }
}

export function PizzaAlarmOverlay({
  eventId,
  initialPizzaAlarmAt = null,
  previewAt = null,
  listen = true,
}: PizzaAlarmOverlayProps) {
  const [visible, setVisible] = useState(false);
  const lastSeenRef = useRef<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const showAlarm = useCallback((at: string, opts?: { force?: boolean }) => {
    if (!at) return;
    if (!opts?.force && lastSeenRef.current === at) return;

    const age = Date.now() - new Date(at).getTime();
    // Allow a few seconds of clock skew ahead; ignore stale alarms unless forced.
    if (!opts?.force) {
      if (Number.isNaN(age) || age > ALARM_WINDOW_MS || age < -10_000) return;
    }

    lastSeenRef.current = at;
    setVisible(true);

    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, OVERLAY_DURATION_MS);
  }, []);

  useEffect(() => {
    if (previewAt) showAlarm(previewAt, { force: true });
  }, [previewAt, showAlarm]);

  useEffect(() => {
    if (listen && initialPizzaAlarmAt) showAlarm(initialPizzaAlarmAt);
  }, [initialPizzaAlarmAt, listen, showAlarm]);

  useEffect(() => {
    if (!listen) return;

    const supabase = createClient();
    const channel = supabase
      .channel(PIZZA_ALARM_CHANNEL(eventId))
      .on("broadcast", { event: PIZZA_ALARM_EVENT }, (msg) => {
        const at = (msg.payload as { at?: string } | undefined)?.at;
        if (at) showAlarm(at);
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          const next = (payload.new as { pizza_alarm_at?: string | null } | null)?.pizza_alarm_at;
          if (next) showAlarm(next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [eventId, listen, showAlarm]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden"
      role="alertdialog"
      aria-label="Pizza has arrived"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Dismiss pizza alarm"
        onClick={() => setVisible(false)}
      />
      <FallingPizzas />
      <Confetti duration={OVERLAY_DURATION_MS} particleCount={90} />

      <div className="relative z-10 flex flex-col items-center px-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative mb-6 flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/30" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-orange-500/20" />
          <div className="relative h-32 w-32 animate-bounce drop-shadow-[0_0_40px_rgba(232,168,56,0.7)]">
            <PizzaSvg className="h-full w-full" />
          </div>
        </div>

        <p className="bg-gradient-to-b from-amber-200 via-orange-300 to-orange-600 bg-clip-text text-5xl font-black tracking-tighter text-transparent drop-shadow-[0_0_30px_rgba(251,146,60,0.8)] sm:text-6xl">
          PIZZA HAS ARRIVED
        </p>
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.35em] text-amber-300/90 sm:text-base">
          Grab a slice
        </p>

        <button
          type="button"
          onClick={() => setVisible(false)}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
