"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";

interface CountdownBarProps {
  event: Event;
}

function decompose(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: String(Math.floor(totalSeconds / 3600)).padStart(2, "0"),
    minutes: String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0"),
    seconds: String(totalSeconds % 60).padStart(2, "0"),
  };
}

export function CountdownBar({ event }: CountdownBarProps) {
  const [timerLabel, setTimerLabel] = useState<string | null>(event.timer_label);
  const [timerEndTime, setTimerEndTime] = useState<string | null>(event.timer_end_time);
  const [timerActive, setTimerActive] = useState<boolean>(event.timer_active);
  const [remainingMs, setRemainingMs] = useState(0);
  const [showExpired, setShowExpired] = useState(false);
  const [hideAfterExpired, setHideAfterExpired] = useState(false);
  const [prevSeconds, setPrevSeconds] = useState("");
  const totalMsRef = useRef<number | null>(null);
  const expireTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setTimerLabel(event.timer_label);
    setTimerEndTime(event.timer_end_time);
    setTimerActive(event.timer_active);
  }, [event.timer_label, event.timer_end_time, event.timer_active]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event-timer-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${event.id}`,
        },
        (payload) => {
          const updated = payload.new as Event;
          setTimerLabel(updated.timer_label);
          setTimerEndTime(updated.timer_end_time);
          setTimerActive(updated.timer_active);

          if (updated.timer_active && updated.timer_end_time) {
            totalMsRef.current = new Date(updated.timer_end_time).getTime() - Date.now();
            setHideAfterExpired(false);
            setShowExpired(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id]);

  useEffect(() => {
    if (expireTimeoutRef.current) {
      window.clearTimeout(expireTimeoutRef.current);
      expireTimeoutRef.current = null;
    }

    if (!timerActive || !timerEndTime) {
      setRemainingMs(0);
      setShowExpired(false);
      setHideAfterExpired(false);
      totalMsRef.current = null;
      return;
    }

    const endMs = new Date(timerEndTime).getTime();
    if (!totalMsRef.current || totalMsRef.current <= 0) {
      totalMsRef.current = Math.max(0, endMs - Date.now());
    }

    const tick = () => {
      const diff = endMs - Date.now();
      if (diff <= 0) {
        setRemainingMs(0);
        if (!showExpired && !hideAfterExpired) {
          setShowExpired(true);
          expireTimeoutRef.current = window.setTimeout(() => {
            setHideAfterExpired(true);
          }, 5000);
        }
        return;
      }

      setRemainingMs(diff);
      setShowExpired(false);
      setHideAfterExpired(false);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [timerActive, timerEndTime, showExpired, hideAfterExpired]);

  if (!timerActive || !timerEndTime || hideAfterExpired) {
    return null;
  }

  const { hours, minutes, seconds } = decompose(remainingMs);
  const totalMs = totalMsRef.current || remainingMs || 1;
  const progress = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  const changed = seconds !== prevSeconds;
  if (changed && prevSeconds !== "") {
    requestAnimationFrame(() => setPrevSeconds(seconds));
  } else if (prevSeconds === "") {
    setPrevSeconds(seconds);
  }

  return (
    <>
      <style>{`
        @keyframes countdown-digit-tick {
          0%   { opacity: 0.4; transform: translateY(2px); }
          100% { opacity: 1;   transform: translateY(0); }
        }
        .countdown-tick {
          animation: countdown-digit-tick 400ms ease-out;
        }
      `}</style>
      <div className="sticky top-0 z-40">
        <div
          className="border-b backdrop-blur-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: showExpired ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)",
          }}
        >
          <div className="max-w-2xl mx-auto px-6 py-5">
            {/* Label */}
            <p className={cn(
              "text-[10px] uppercase tracking-[0.3em] font-medium text-center mb-4",
              showExpired ? "text-red-400" : "text-gray-500"
            )}>
              {showExpired ? "Time's Up" : (timerLabel || "Countdown")}
            </p>

            {/* Digit groups */}
            <div className="flex items-start justify-center" role="timer">
              <DigitGroup value={hours} label="Hours" expired={showExpired} />
              <span className={cn(
                "text-3xl sm:text-4xl font-light px-3 sm:px-4 select-none leading-none",
                showExpired ? "text-red-400/60" : "text-gray-600"
              )}>
                :
              </span>
              <DigitGroup value={minutes} label="Minutes" expired={showExpired} />
              <span className={cn(
                "text-3xl sm:text-4xl font-light px-3 sm:px-4 select-none leading-none",
                showExpired ? "text-red-400/60" : "text-gray-600"
              )}>
                :
              </span>
              <DigitGroup value={seconds} label="Seconds" expired={showExpired} animate />
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-[2px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-linear",
                  showExpired ? "bg-red-500" : "bg-white/40"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DigitGroup({
  value,
  label,
  expired,
  animate,
}: {
  value: string;
  label: string;
  expired: boolean;
  animate?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        key={animate ? value : undefined}
        className={cn(
          "text-4xl sm:text-5xl font-bold tabular-nums leading-none tracking-tight",
          expired ? "text-red-400" : "text-white",
          animate && "countdown-tick"
        )}
      >
        {value}
      </span>
      <span className={cn(
        "text-[9px] uppercase tracking-[0.12em] font-medium",
        expired ? "text-red-400/60" : "text-gray-600"
      )}>
        {label}
      </span>
    </div>
  );
}
