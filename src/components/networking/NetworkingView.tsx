"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { NETWORKING_COLORS } from "@/lib/networking/colors";
import type {
  SpeedNetworkingSession,
  SpeedNetworkingRound,
  SpeedNetworkingPair,
} from "@/types";

const COLOR_MAP = Object.fromEntries(NETWORKING_COLORS.map((c) => [c.id, c]));

const CONVERSATION_STARTERS = [
  "What's the most surprising thing you've built with AI?",
  "What problem are you actively trying to solve right now?",
  "What would you build if you had 10× more engineering time?",
  "Where do you think AI coding tools are headed in 2 years?",
  "What's a tool or workflow that completely changed how you work?",
  "Are you here to learn, build, or connect — what's your goal tonight?",
  "What's the hardest part of what you're working on right now?",
  "What would you do differently if you started over from scratch?",
];

interface Props {
  eventId: string;
  userId: string;
  initialSession: SpeedNetworkingSession | null;
  initialRound: SpeedNetworkingRound | null;
  initialPair: SpeedNetworkingPair | null;
}

export function NetworkingView({
  eventId,
  userId,
  initialSession,
  initialRound,
  initialPair,
}: Props) {
  const [session, setSession] = useState(initialSession);
  const [round, setRound] = useState(initialRound);
  const [pair, setPair] = useState(initialPair);
  const [countdown, setCountdown] = useState<string>("");
  const [progress, setProgress] = useState(100);

  // Fetch the user's pair for the current round
  const fetchPair = useCallback(async (roundId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("speed_networking_pairs")
      .select(
        "*, user1:users!speed_networking_pairs_user1_id_fkey(id, name), user2:users!speed_networking_pairs_user2_id_fkey(id, name)"
      )
      .eq("round_id", roundId)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .maybeSingle();
    setPair(data ?? null);
  }, [userId]);

  // Fetch the latest round for a session
  const fetchRound = useCallback(async (sessionId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("speed_networking_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setRound(data);
      fetchPair(data.id);
    }
  }, [fetchPair]);

  // Real-time subscriptions
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`networking-attendee-${eventId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "speed_networking_sessions",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as SpeedNetworkingSession;
          setSession(updated);
          if (updated.status === "active" || updated.status === "between_rounds") {
            fetchRound(updated.id);
          }
          if (updated.status === "ended") {
            setRound(null);
            setPair(null);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "speed_networking_rounds",
        },
        (payload) => {
          const newRound = payload.new as SpeedNetworkingRound;
          setRound(newRound);
          fetchPair(newRound.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "speed_networking_pairs",
        },
        (payload) => {
          const newPair = payload.new as SpeedNetworkingPair;
          if (newPair.user1_id === userId || newPair.user2_id === userId) {
            // Fetch with joined user data
            if (round) fetchPair(round.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, userId, round, fetchRound, fetchPair]);

  // Countdown + progress bar
  useEffect(() => {
    if (!round?.ends_at || !round?.started_at || session?.status !== "active") {
      setCountdown("");
      setProgress(100);
      return;
    }

    const tick = () => {
      const total = new Date(round.ends_at!).getTime() - new Date(round.started_at!).getTime();
      const remaining = new Date(round.ends_at!).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown("00:00");
        setProgress(0);
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
      setProgress(Math.max(0, (remaining / total) * 100));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [round?.ends_at, round?.started_at, session?.status]);

  // ── No session or idle ────────────────────────────────────────────────────
  if (!session || session.status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-light text-white/80 tracking-tight">Speed Networking</h2>
          <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
            Your facilitator will start a round shortly. Keep this screen open and ready.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Session ended ─────────────────────────────────────────────────────────
  if (session.status === "ended") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
          <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-light text-white/80 tracking-tight">Session Complete</h2>
          <p className="text-sm text-gray-500">
            {session.current_round} round{session.current_round !== 1 ? "s" : ""} of great conversations.
          </p>
        </div>
      </div>
    );
  }

  // ── Between rounds ────────────────────────────────────────────────────────
  if (session.status === "between_rounds") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
            Round {session.current_round} Complete
          </p>
          <h2 className="text-2xl font-light text-white/80 tracking-tight">Next round starting soon</h2>
          <p className="text-sm text-gray-600">Stay here — your next match is being assigned.</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Active round ──────────────────────────────────────────────────────────
  const colorDef = pair ? COLOR_MAP[pair.color_code] : null;
  const bg = colorDef?.bg ?? "#1a1a1a";
  const label = colorDef?.label ?? "—";

  // Determine partner name (we could be user1 or user2)
  const partnerName = pair
    ? pair.user2_id
      ? pair.user1_id === userId
        ? pair.user2?.name ?? "Your Partner"
        : pair.user1?.name ?? "Your Partner"
      : null // wildcard
    : null;

  // Pick a conversation starter deterministically from round number + pair color index
  const colorIdx = NETWORKING_COLORS.findIndex((c) => c.id === pair?.color_code);
  const starterIdx = ((round?.round_number ?? 1) - 1 + Math.max(0, colorIdx)) % CONVERSATION_STARTERS.length;
  const starter = CONVERSATION_STARTERS[starterIdx];

  return (
    <div className="flex flex-col animate-fade-in -mx-6 -mt-12">
      {/* Countdown bar */}
      <div className="h-1 bg-white/5 w-full">
        <div
          className="h-full bg-white/40 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timer pill */}
      <div className="flex justify-between items-center px-6 pt-4 pb-3">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
          Round {session.current_round}
        </p>
        {countdown && (
          <p className="text-2xl font-light tabular-nums tracking-tight text-white/70">
            {countdown}
          </p>
        )}
      </div>

      {/* Color block — the main UI */}
      {pair ? (
        <div
          className="mx-4 rounded-[40px] flex flex-col items-center justify-center text-white transition-colors duration-700 shadow-2xl"
          style={{
            backgroundColor: bg,
            minHeight: "55vh",
            boxShadow: `0 0 80px ${bg}55, 0 30px 60px rgba(0,0,0,0.5)`,
          }}
        >
          {partnerName ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.5em] font-bold opacity-60 mb-4">
                Find your partner
              </p>
              <h1 className="text-8xl font-black tracking-tight mb-6 opacity-90">
                {label}
              </h1>
              <p className="text-3xl font-light tracking-tight mb-2 opacity-95">
                {partnerName}
              </p>
              <p className="text-[11px] uppercase tracking-[0.3em] opacity-50 mb-10">
                Hold up your screen
              </p>
            </>
          ) : (
            // Wildcard — no partner assigned
            <>
              <p className="text-[11px] uppercase tracking-[0.5em] font-bold opacity-60 mb-4">
                Free Agent
              </p>
              <h1 className="text-7xl font-black tracking-tight mb-6 opacity-90">
                {label}
              </h1>
              <p className="text-xl font-light tracking-tight opacity-80 mb-2 max-w-[200px] text-center">
                Join any conversation you like!
              </p>
            </>
          )}
        </div>
      ) : (
        // Waiting for pair assignment
        <div className="mx-4 rounded-[40px] bg-white/[0.03] border border-white/[0.05] flex flex-col items-center justify-center" style={{ minHeight: "55vh" }}>
          <div className="w-12 h-12 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 text-sm">Assigning your pair...</p>
        </div>
      )}

      {/* Conversation starter */}
      {pair && partnerName && (
        <div className="mx-4 mt-4 glass rounded-3xl p-6 border-white/10 animate-slide-up" style={{ animationDelay: "100ms" }}>
          <p className="text-[9px] uppercase tracking-[0.4em] text-gray-600 font-medium mb-3">
            Conversation starter
          </p>
          <p className="text-sm text-white/80 leading-relaxed font-light italic">
            &ldquo;{starter}&rdquo;
          </p>
        </div>
      )}

      {pair?.match_reason && partnerName && (
        <div className="mx-4 mt-3 px-6 py-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 font-medium mb-1">Why you&apos;re matched</p>
          <p className="text-xs text-gray-500 leading-relaxed">{pair.match_reason}</p>
        </div>
      )}
    </div>
  );
}

