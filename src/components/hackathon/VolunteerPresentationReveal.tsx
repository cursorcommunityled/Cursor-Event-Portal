"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic2, X } from "lucide-react";
import { Confetti } from "@/components/competitions/Confetti";

export type PresentationTeam = { id: string; name: string };

interface Props {
  eventId: string;
  pickedAt: string | null | undefined;
  selectedTeams: PresentationTeam[];
  volunteerNames: string[];
}

const SPIN_MS = 4200;
const HOLD_MS = 9000;

export function VolunteerPresentationReveal({
  eventId,
  pickedAt,
  selectedTeams,
  volunteerNames,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealed">("idle");
  const [spinLabel, setSpinLabel] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const lastPickedRef = useRef<string | null>(null);

  const pool = useMemo(() => {
    const names = volunteerNames.length > 0
      ? volunteerNames
      : selectedTeams.map((t) => t.name);
    return names.length > 0 ? names : ["..."];
  }, [volunteerNames, selectedTeams]);

  useEffect(() => {
    if (!pickedAt || selectedTeams.length === 0) return;
    if (lastPickedRef.current === pickedAt) return;

    const storageKey = `hackathon:present-reveal:${eventId}:${pickedAt}`;
    try {
      if (window.localStorage.getItem(storageKey) === "seen") {
        lastPickedRef.current = pickedAt;
        return;
      }
      window.localStorage.setItem(storageKey, "seen");
    } catch {
      // storage unavailable — still animate once per mount for this pick
    }

    lastPickedRef.current = pickedAt;
    setDismissed(false);
    setPhase("spinning");

    let i = 0;
    const spinInterval = window.setInterval(() => {
      setSpinLabel(pool[i % pool.length]);
      i += 1;
    }, 90);

    const revealTimer = window.setTimeout(() => {
      window.clearInterval(spinInterval);
      setPhase("revealed");
    }, SPIN_MS);

    const hideTimer = window.setTimeout(() => {
      setPhase("idle");
    }, SPIN_MS + HOLD_MS);

    return () => {
      window.clearInterval(spinInterval);
      window.clearTimeout(revealTimer);
      window.clearTimeout(hideTimer);
    };
  }, [pickedAt, selectedTeams, eventId, pool]);

  if (dismissed || phase === "idle") return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/80 backdrop-blur-md">
      {(phase === "spinning" || phase === "revealed") && (
        <Confetti duration={SPIN_MS + HOLD_MS} particleCount={phase === "revealed" ? 140 : 40} />
      )}

      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          setPhase("idle");
        }}
        className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/50 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative mx-4 w-full max-w-lg animate-in fade-in zoom-in duration-500">
        <div className="rounded-[32px] border border-white/20 bg-black/70 p-8 shadow-[0_0_80px_rgba(255,255,255,0.15)] backdrop-blur-xl sm:p-10">
          <div className="mb-6 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">
            <Mic2 className="h-4 w-4 text-white" />
            Volunteer Presentations
          </div>

          {phase === "spinning" ? (
            <div className="space-y-4 text-center">
              <p className="text-[12px] font-bold uppercase tracking-[0.25em] text-gray-500">
                Spinning the pool
              </p>
              <p className="min-h-[3.5rem] text-4xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.35)] sm:text-5xl">
                {spinLabel || pool[0]}
              </p>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <p className="bg-gradient-to-b from-white to-gray-400 bg-clip-text text-3xl font-black tracking-tighter text-transparent sm:text-4xl">
                Presenting tonight
              </p>
              <ol className="space-y-3">
                {selectedTeams.map((team, index) => (
                  <li
                    key={team.id}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left"
                  >
                    <span className="mr-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">
                      {index + 1}
                    </span>
                    <span className="text-lg font-bold text-white">{team.name}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PresentingCardProps {
  teams: PresentationTeam[];
}

export function PresentingTonightCard({ teams }: PresentingCardProps) {
  if (teams.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/50 p-5 shadow-lg backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08)_0,transparent_55%)]" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
          <Mic2 className="h-3.5 w-3.5 text-white" />
          Presenting tonight
        </div>
        <ul className="space-y-2">
          {teams.map((team, index) => (
            <li key={team.id} className="flex items-center gap-3 text-[15px] font-semibold text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[11px] font-black text-black">
                {index + 1}
              </span>
              {team.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
