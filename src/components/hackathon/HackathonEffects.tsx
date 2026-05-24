"use client";

import { useEffect, useState, useRef } from "react";
import { Confetti } from "@/components/competitions/Confetti";
import Image from "next/image";

interface Props {
  eventId: string;
  userId: string;
  scoresCount: number;
  projectSubmitted: boolean;
  eventStarted: boolean;
  teamFormed: boolean;
}

const START_EFFECT_DURATION_MS = 8000;

export function HackathonEffects({ eventId, userId, scoresCount, projectSubmitted, eventStarted, teamFormed }: Props) {
  const [showScoreEffect, setShowScoreEffect] = useState(false);
  const [showSubmitEffect, setShowSubmitEffect] = useState(false);
  const [showStartEffect, setShowStartEffect] = useState(false);
  const [showTeamEffect, setShowTeamEffect] = useState(false);
  
  const isFirstRenderScore = useRef(true);
  const isFirstRenderSubmit = useRef(true);
  const isFirstRenderTeam = useRef(true);
  const prevScoresCount = useRef(scoresCount);
  const prevProjectSubmitted = useRef(projectSubmitted);
  const prevEventStarted = useRef(eventStarted);
  const prevTeamFormed = useRef(teamFormed);
  const startEffectShownThisMount = useRef(false);
  const startEffectStorageKey = `hackathon:start-effect:${eventId}:${userId}`;

  // Trigger on new score
  useEffect(() => {
    if (isFirstRenderScore.current) {
      isFirstRenderScore.current = false;
      return;
    }
    if (scoresCount > prevScoresCount.current) {
      setShowScoreEffect(true);
      const t = setTimeout(() => setShowScoreEffect(false), 5000);
      return () => clearTimeout(t);
    }
  }, [scoresCount]);

  // Trigger on project submission
  useEffect(() => {
    if (isFirstRenderSubmit.current) {
      isFirstRenderSubmit.current = false;
      return;
    }
    if (projectSubmitted && !prevProjectSubmitted.current) {
      setShowSubmitEffect(true);
      const t = setTimeout(() => setShowSubmitEffect(false), 8000);
      return () => clearTimeout(t);
    }
  }, [projectSubmitted]);

  // Trigger on event start
  useEffect(() => {
    if (!eventStarted) return;

    try {
      if (window.localStorage.getItem(startEffectStorageKey) === "seen") return;
      window.localStorage.setItem(startEffectStorageKey, "seen");
    } catch {
      // If storage is unavailable, keep the effect scoped to this mount.
      if (startEffectShownThisMount.current) return;
      startEffectShownThisMount.current = true;
    }

    setShowStartEffect(true);
    const t = setTimeout(() => setShowStartEffect(false), START_EFFECT_DURATION_MS);
    return () => clearTimeout(t);
  }, [eventStarted, startEffectStorageKey]);

  // Trigger on team formed
  useEffect(() => {
    if (isFirstRenderTeam.current) {
      isFirstRenderTeam.current = false;
      return;
    }
    if (teamFormed && !prevTeamFormed.current) {
      setShowTeamEffect(true);
      const t = setTimeout(() => setShowTeamEffect(false), 6000);
      return () => clearTimeout(t);
    }
  }, [teamFormed]);

  // Update refs after all checks
  useEffect(() => {
    prevScoresCount.current = scoresCount;
    prevProjectSubmitted.current = projectSubmitted;
    prevEventStarted.current = eventStarted;
    prevTeamFormed.current = teamFormed;
  });

  // Debug triggers
  const triggerScore = () => {
    setShowScoreEffect(false);
    setTimeout(() => {
      setShowScoreEffect(true);
      setTimeout(() => setShowScoreEffect(false), 5000);
    }, 50);
  };
  const triggerSubmit = () => {
    setShowSubmitEffect(false);
    setTimeout(() => {
      setShowSubmitEffect(true);
      setTimeout(() => setShowSubmitEffect(false), 8000);
    }, 50);
  };
  const triggerStart = () => {
    setShowStartEffect(false);
    setTimeout(() => {
      setShowStartEffect(true);
      setTimeout(() => setShowStartEffect(false), START_EFFECT_DURATION_MS);
    }, 50);
  };
  const triggerTeam = () => {
    setShowTeamEffect(false);
    setTimeout(() => {
      setShowTeamEffect(true);
      setTimeout(() => setShowTeamEffect(false), 6000);
    }, 50);
  };

  return (
    <>
      {/* Debug Panel (visible only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 rounded-xl border border-white/20 bg-black/80 p-4 shadow-2xl backdrop-blur-xl">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Test Effects</p>
          <button onClick={triggerScore} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20">
            Score Posted
          </button>
          <button onClick={triggerSubmit} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20">
            Project Submitted
          </button>
          <button onClick={triggerStart} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20">
            Event Started
          </button>
          <button onClick={triggerTeam} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20">
            Team Formed
          </button>
        </div>
      )}

      {(showScoreEffect || showSubmitEffect || showStartEffect || showTeamEffect) ? (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
          <Confetti duration={showStartEffect ? START_EFFECT_DURATION_MS : 8000} particleCount={showStartEffect || showSubmitEffect || showTeamEffect ? 150 : 50} />

          {showScoreEffect ? (
            <div className="animate-in fade-in zoom-in duration-500 slide-out-to-top-8 fade-out duration-1000 delay-3000 absolute top-20 flex flex-col items-center">
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-yellow-500/40 bg-white shadow-[0_0_40px_rgba(234,179,8,0.5)]">
                <div className="absolute inset-0 animate-pulse bg-yellow-500/10" />
                <img src="/trophy.jpeg" alt="Trophy" className="relative z-10 h-full w-full scale-[1.15] object-cover" style={{ mixBlendMode: 'multiply' }} />
              </div>
              <p className="mt-4 text-2xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                NEW SCORE POSTED
              </p>
            </div>
          ) : null}

          {showTeamEffect ? (
            <div className="animate-in fade-in zoom-in duration-700 slide-out-to-bottom-8 fade-out duration-1000 delay-4000 absolute flex flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-[32px] border border-red-500/40 bg-black/60 shadow-[0_0_60px_rgba(239,68,68,0.5)] backdrop-blur-xl">
                <div className="absolute inset-0 animate-ping rounded-[32px] bg-red-500/20 opacity-50" />
                <div className="relative h-16 w-16 opacity-90">
                  <Image src="/cursor-logo.svg" alt="Cursor" fill className="object-contain" />
                </div>
              </div>
              <p className="mt-6 bg-gradient-to-b from-red-300 to-red-600 bg-clip-text text-4xl font-black tracking-tighter text-transparent drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
                TEAM FORMED!
              </p>
              <p className="mt-2 text-lg font-bold uppercase tracking-[0.3em] text-red-400">
                Ready to build
              </p>
            </div>
          ) : null}

          {showSubmitEffect ? (
            <div className="animate-in fade-in zoom-in duration-700 slide-out-to-bottom-8 fade-out duration-1000 delay-5000 absolute flex flex-col items-center">
              <div className="relative flex h-40 w-40 items-center justify-center rounded-[40px] border border-green-500/40 bg-black/60 shadow-[0_0_80px_rgba(74,222,128,0.5)] backdrop-blur-xl">
                <div className="absolute inset-0 animate-ping rounded-[40px] bg-green-500/20 opacity-50" />
                <div className="relative h-20 w-20 animate-bounce opacity-90">
                  <Image src="/cursor-logo.svg" alt="Cursor" fill className="object-contain" />
                </div>
              </div>
              <p className="mt-6 bg-gradient-to-b from-green-300 to-green-600 bg-clip-text text-5xl font-black tracking-tighter text-transparent drop-shadow-[0_0_20px_rgba(74,222,128,0.8)]">
                PROJECT SUBMITTED!
              </p>
              <p className="mt-2 text-lg font-bold uppercase tracking-[0.3em] text-green-400">
                Awaiting Analysis
              </p>
            </div>
          ) : null}

          {showStartEffect ? (
            <div className="animate-in fade-in zoom-in duration-700 slide-out-to-top-12 fade-out duration-1000 delay-5000 absolute flex flex-col items-center">
              <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-yellow-500/40 bg-black/60 shadow-[0_0_100px_rgba(234,179,8,0.6)] backdrop-blur-xl">
                <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/20 opacity-50" />
                <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(234,179,8,0.5),transparent)]" />
                <div className="relative h-24 w-24 opacity-100">
                  <Image src="/cursor-logo.svg" alt="Cursor" fill className="object-contain" />
                </div>
              </div>
              <p className="mt-8 bg-gradient-to-b from-yellow-200 to-yellow-600 bg-clip-text text-6xl font-black tracking-tighter text-transparent drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]">
                HACKATHON STARTED
              </p>
              <p className="mt-3 text-xl font-bold uppercase tracking-[0.4em] text-yellow-400">
                Let the building begin
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
