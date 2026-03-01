"use client";

import { Sparkles, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationTheme } from "@/types";

interface AttendeeThemesViewProps {
  activeTheme: ConversationTheme | null;
}

// Placeholder topic count — replace with real data when LLM generation is wired up
const PLACEHOLDER_TOPIC_COUNT = 5;

export function AttendeeThemesView({ activeTheme }: AttendeeThemesViewProps) {
  return (
    <div className="space-y-10">
      {/* ── Active Theme ─────────────────────────────────────── */}
      {activeTheme ? (
        <div className="space-y-3 animate-slide-up">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
            Tonight&apos;s Theme
          </p>
          <div className="glass rounded-3xl p-8 border-white/20 shadow-glow">
            <div className="flex items-start gap-5">
              <span className="text-5xl leading-none mt-1">{activeTheme.emoji ?? "🎯"}</span>
              <div className="space-y-2">
                {activeTheme.category && (
                  <span className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-medium">
                    {activeTheme.category}
                  </span>
                )}
                <h2 className="text-3xl font-light text-white tracking-tight">
                  {activeTheme.name}
                </h2>
                {activeTheme.description && (
                  <p className="text-sm text-gray-400 leading-relaxed max-w-md">
                    {activeTheme.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl p-8 border-white/10 text-center animate-slide-up">
          <Sparkles className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-white/60 font-light">Theme not yet selected</p>
          <p className="text-sm text-gray-600 mt-1">Check back closer to the event</p>
        </div>
      )}

      {/* ── Topic Allocation Game ─────────────────────────────── */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
            Your Topics
          </p>
          {/* Badge: shows when topics are ready */}
          <span className="text-[9px] uppercase tracking-widest font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-600">
            Coming Soon
          </span>
        </div>

        {/* Topic slots — framed, not yet functional */}
        <div className="glass rounded-3xl p-6 border-white/10 space-y-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Based on your survey responses, we&apos;ll generate a personalised set of
            conversation topics within tonight&apos;s theme. You&apos;ll pick your
            favourites and carry them into your table discussions.
          </p>

          {/* Placeholder topic cards */}
          <div className="grid grid-cols-1 gap-2 mt-4">
            {Array.from({ length: PLACEHOLDER_TOPIC_COUNT }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-12 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse",
                )}
                style={{ animationDelay: `${i * 80}ms`, animationDuration: "2s" }}
              />
            ))}
          </div>

          {/* CTA — disabled until LLM generation is wired */}
          <button
            disabled
            className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 bg-white/5 text-gray-600 text-sm font-medium cursor-not-allowed transition-all"
          >
            <Shuffle className="w-4 h-4" />
            Generate My Topics
          </button>
        </div>
      </div>
    </div>
  );
}
