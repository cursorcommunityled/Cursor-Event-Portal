"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createNetworkingSession,
  startNetworkingRound,
  endNetworkingRound,
  endNetworkingSession,
  deleteNetworkingSession,
} from "@/lib/actions/networking";
import { NETWORKING_COLORS } from "@/lib/networking/colors";
import type {
  SpeedNetworkingSession,
  SpeedNetworkingRound,
  SpeedNetworkingPair,
} from "@/types";

const COLOR_MAP = Object.fromEntries(
  NETWORKING_COLORS.map((c) => [c.id, c])
);

const DURATION_OPTIONS = [
  { label: "3 min", value: 180 },
  { label: "5 min", value: 300 },
  { label: "7 min", value: 420 },
  { label: "10 min", value: 600 },
];

interface Props {
  eventId: string;
  adminCode: string;
  initialSession: SpeedNetworkingSession | null;
  initialRound: SpeedNetworkingRound | null;
  initialPairs: SpeedNetworkingPair[];
}

export function NetworkingAdminClient({
  eventId,
  adminCode,
  initialSession,
  initialRound,
  initialPairs,
}: Props) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [round, setRound] = useState(initialRound);
  const [pairs, setPairs] = useState(initialPairs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(300);
  const [countdown, setCountdown] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!round?.ends_at || session?.status !== "active") {
      setCountdown("");
      return;
    }
    const tick = () => {
      const remaining = new Date(round.ends_at!).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown("00:00");
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [round?.ends_at, session?.status]);

  // Real-time subscriptions
  const refreshData = useCallback(async () => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`networking-admin-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "speed_networking_sessions", filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (payload.new) setSession(payload.new as SpeedNetworkingSession);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "speed_networking_rounds" },
        () => refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "speed_networking_pairs" },
        () => refreshData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, refreshData]);

  const handleCreateSession = async () => {
    setLoading(true);
    setError(null);
    const result = await createNetworkingSession(eventId, selectedDuration, adminCode);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleStartRound = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const result = await startNetworkingRound(session.id, eventId, adminCode);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleEndRound = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const result = await endNetworkingRound(session.id, adminCode);
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  };

  const handleEndSession = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const result = await endNetworkingSession(session.id, adminCode);
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!session) return;
    setLoading(true);
    const result = await deleteNetworkingSession(session.id, adminCode);
    if (result.error) setError(result.error);
    else {
      setSession(null);
      setRound(null);
      setPairs([]);
      setConfirmDelete(false);
      router.refresh();
    }
    setLoading(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      idle: "bg-white/10 text-white/50",
      active: "bg-green-500/20 text-green-400 border-green-500/30",
      between_rounds: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      ended: "bg-white/5 text-white/20",
    };
    const labels: Record<string, string> = {
      idle: "Ready",
      active: "Live",
      between_rounds: "Between Rounds",
      ended: "Ended",
    };
    return (
      <span className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.3em] font-bold border ${map[status] ?? "bg-white/5 text-white/30"}`}>
        {labels[status] ?? status}
      </span>
    );
  };

  // ── No session — creation screen ────────────────────────────────────────────
  if (!session) {
    return (
      <div className="space-y-8">
        <div className="glass rounded-[40px] p-10 border-white/10">
          <div className="max-w-md space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-light tracking-tight">Create Session</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Set up a speed networking session. Attendees will be paired based on their intake goals and offers. Each pair gets a unique color — they hold up their screens to find each other.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Round Duration</p>
              <div className="grid grid-cols-4 gap-3">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDuration(opt.value)}
                    className={`py-3 rounded-2xl text-sm font-medium transition-all border ${
                      selectedDuration === opt.value
                        ? "bg-white text-black border-white shadow-glow"
                        : "bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateSession}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-white text-black font-semibold text-sm hover:scale-[1.01] transition-all disabled:opacity-40"
            >
              {loading ? "Creating..." : "Create Session"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Session exists ──────────────────────────────────────────────────────────
  const isActive = session.status === "active";
  const isBetween = session.status === "between_rounds";
  const isEnded = session.status === "ended";

  return (
    <div className="space-y-8">
      {/* Session header */}
      <div className="glass rounded-[40px] p-10 border-white/10">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-light tracking-tight">Speed Networking</h2>
              {statusBadge(session.status)}
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-medium">
              Round {session.current_round} &middot; {session.round_duration_seconds / 60} min rounds
            </p>
          </div>

          {isActive && countdown && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-medium mb-1">Time Remaining</p>
              <p className="text-5xl font-light tabular-nums tracking-tight">{countdown}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4">
          {(session.status === "idle" || isBetween) && (
            <button
              onClick={handleStartRound}
              disabled={loading}
              className="px-8 py-3.5 bg-white text-black rounded-full font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-40"
            >
              {loading ? "Generating..." : session.status === "idle" ? "Start Round 1" : `Start Round ${session.current_round + 1}`}
            </button>
          )}

          {isActive && (
            <button
              onClick={handleEndRound}
              disabled={loading}
              className="px-8 py-3.5 bg-white/10 border border-white/20 text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-all disabled:opacity-40"
            >
              {loading ? "Ending..." : "End Round"}
            </button>
          )}

          {(isActive || isBetween) && (
            <button
              onClick={handleEndSession}
              disabled={loading}
              className="px-8 py-3.5 text-gray-600 hover:text-red-400 transition-colors font-bold text-xs uppercase tracking-widest"
            >
              End Session
            </button>
          )}

          {(isEnded || session.status === "idle") && (
            confirmDelete ? (
              <div className="flex items-center gap-3 animate-fade-in">
                <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">Delete session?</span>
                <button onClick={handleDelete} disabled={loading} className="px-6 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-full font-bold text-xs uppercase tracking-widest">
                  Yes, Delete
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-4 py-2.5 bg-white/5 border border-white/10 text-gray-400 rounded-full font-bold text-xs uppercase tracking-widest">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="px-8 py-3.5 text-gray-700 hover:text-red-400 transition-colors font-bold text-xs uppercase tracking-widest">
                Delete Session
              </button>
            )
          )}
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Pairs for current round */}
      {pairs.length > 0 && round && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h3 className="text-[11px] uppercase tracking-[0.5em] text-gray-500 font-medium">
              Round {round.round_number} Pairs
            </h3>
            <div className="h-[1px] flex-1 bg-white/[0.03]" />
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">{pairs.filter(p => p.user2_id).length} pairs · {pairs.filter(p => !p.user2_id).length > 0 ? `${pairs.filter(p => !p.user2_id).length} wildcard` : ""}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pairs.map((pair) => {
              const colorDef = COLOR_MAP[pair.color_code];
              const bg = colorDef?.bg ?? "#333";
              const label = colorDef?.label ?? pair.color_code.toUpperCase();

              return (
                <div key={pair.id} className="glass rounded-[32px] p-6 border-white/[0.03] flex items-center gap-5">
                  {/* Color swatch */}
                  <div
                    className="w-14 h-14 rounded-2xl flex-shrink-0 shadow-lg"
                    style={{ backgroundColor: bg }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.3em] font-bold mb-2" style={{ color: bg }}>
                      {label}
                    </p>
                    {pair.user2_id ? (
                      <>
                        <p className="text-base font-light text-white/90 truncate">{pair.user1?.name ?? "—"}</p>
                        <p className="text-[10px] text-gray-600 my-0.5">↔</p>
                        <p className="text-base font-light text-white/90 truncate">{pair.user2?.name ?? "—"}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-light text-white/90 truncate">{pair.user1?.name ?? "—"}</p>
                        <p className="text-[10px] text-gray-600 mt-1">Free Agent</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state for active session with no pairs yet */}
      {session.status === "idle" && (
        <div className="glass rounded-[40px] p-10 border-white/[0.03] text-center">
          <p className="text-gray-600 text-sm uppercase tracking-[0.3em] font-medium">No rounds yet</p>
          <p className="text-gray-700 text-xs mt-2">Hit Start Round 1 to generate pairings from checked-in attendees.</p>
        </div>
      )}

      {isEnded && (
        <div className="glass rounded-[40px] p-10 border-white/[0.03] text-center space-y-3">
          <p className="text-white/60 font-light text-lg">Session complete</p>
          <p className="text-gray-600 text-xs uppercase tracking-[0.2em]">{session.current_round} round{session.current_round !== 1 ? "s" : ""} completed</p>
          <button
            onClick={() => { setConfirmDelete(false); handleDelete(); }}
            className="mt-4 px-6 py-3 bg-white/5 border border-white/10 text-white/50 rounded-full text-xs uppercase tracking-widest hover:text-white transition-colors"
          >
            Start New Session
          </button>
        </div>
      )}
    </div>
  );
}
