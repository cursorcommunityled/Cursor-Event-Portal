"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventTimerProps {
  startTime: string; // ISO string for event start (5:00 PM Jan 28, 2026)
  redThreshold: number; // Minutes when timer turns red (210 = 3.5 hours = 8:30 PM)
}

export function EventTimer({ startTime, redThreshold }: EventTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const diff = now - start;

      if (diff < 0) {
        setElapsed(0);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      setElapsed(minutes);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const hours = Math.floor(elapsed / 60);
  const minutes = elapsed % 60;
  const isRed = elapsed >= redThreshold;

  const formatTime = (h: number, m: number) => {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 glass rounded-2xl px-4 py-3 border backdrop-blur-3xl transition-all duration-300 shadow-xl",
        isRed
          ? "border-red-500/30 bg-red-500/10 text-red-400"
          : "border-white/10 bg-white/5 text-white"
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className={cn("w-4 h-4", isRed ? "text-red-400" : "text-gray-400")} />
        <div className="flex flex-col">
          <span className="text-xs font-mono font-medium tabular-nums">
            {formatTime(hours, minutes)}
          </span>
          <span className="text-[8px] uppercase tracking-[0.15em] text-gray-600">
            Elapsed
          </span>
        </div>
      </div>
    </div>
  );
}

