"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { claimEasterEgg, getMyClaimedEggs } from "@/lib/actions/easter-eggs";

type Phase =
  | "idle"
  | "appearing"
  | "shaking"
  | "cracking"
  | "exploding"
  | "revealed"
  | "claiming"
  | "flying"
  | "done";

const EGG_LABELS: Record<string, string> = {
  egg_1: "The Venue Secret",
  egg_2: "The Resource Treasure",
  egg_3: "The Chat Spell",
};

const PARTICLE_COLORS = [
  "#ffffff", "#e4e4e4", "#b0b0b0", "#d0d0d0",
  "#f5f5f5", "#888888", "#cccccc", "#f0f0f0",
  "#aaaaaa", "#e8e8e8", "#999999", "#dddddd",
];

// Stable particles (generated once, not per render)
const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const angle = (360 / 28) * i;
  const distance = 100 + (i % 5) * 22;
  const size = 5 + (i % 4) * 3;
  const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
  const delay = (i % 6) * 0.05;
  const isRect = i % 4 === 2;
  return { id: i, angle, distance, size, color, delay, isRect };
});

function EggSVG() {
  return (
    <svg viewBox="0 0 100 130" width="156" height="204" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="egg-main" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1c1c1c" />
          <stop offset="50%" stopColor="#111111" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
        <filter id="egg-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main egg shape */}
      <path
        d="M50 5 C22 5 5 40 5 68 C5 103 22 128 50 128 C78 128 95 103 95 68 C95 40 78 5 50 5Z"
        fill="url(#egg-main)"
        filter="url(#egg-glow)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.5"
      />

      {/* Subtle white zigzag stripe */}
      <polyline
        points="6,70 18,59 30,70 42,59 58,70 70,59 82,70 94,59"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cursor logo */}
      <image
        href="/cursor-logo.png"
        x="22"
        y="42"
        width="56"
        height="56"
        preserveAspectRatio="xMidYMid meet"
      />

      {/* Shine highlight */}
      <ellipse
        cx="31"
        cy="22"
        rx="11"
        ry="7"
        fill="rgba(255,255,255,0.22)"
        transform="rotate(-28 31 22)"
      />
    </svg>
  );
}

function CrackSVG() {
  return (
    <svg
      viewBox="0 0 100 130"
      width="156"
      height="204"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {/* Main crack */}
      <path
        d="M50 48 L44 68 L57 76 L40 116"
        fill="none"
        stroke="rgba(0,0,0,0.75)"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{
          strokeDasharray: "130",
          strokeDashoffset: "130",
          animation: "egg-crack-1 0.5s ease-out forwards",
        }}
      />
      {/* Branch crack right */}
      <path
        d="M50 48 L61 62 L54 72"
        fill="none"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          strokeDasharray: "45",
          strokeDashoffset: "45",
          animation: "egg-crack-2 0.35s 0.12s ease-out forwards",
        }}
      />
      {/* Hairline branch */}
      <path
        d="M44 68 L36 78 L44 84"
        fill="none"
        stroke="rgba(0,0,0,0.38)"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{
          strokeDasharray: "30",
          strokeDashoffset: "30",
          animation: "egg-crack-3 0.28s 0.24s ease-out forwards",
        }}
      />
    </svg>
  );
}

export function EasterEggOverlay({
  eventSlug,
  userId,
}: {
  eventSlug: string;
  userId?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentEggId, setCurrentEggId] = useState("");
  const [claimResult, setClaimResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const foundThisSession = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // On mount, fetch already-claimed eggs so they can't be re-triggered
  useEffect(() => {
    getMyClaimedEggs(eventSlug).then((claimed) => {
      claimed.forEach((id) => foundThisSession.current.add(id));
    });
  }, [eventSlug]);

  const clearAllTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const triggerEgg = useCallback(
    (eggId: string) => {
      if (phase !== "idle") return;
      if (foundThisSession.current.has(eggId)) return;

      clearAllTimers();
      setCurrentEggId(eggId);
      setClaimResult(null);
      setPhase("appearing");

      const t1 = setTimeout(() => setPhase("shaking"), 950);
      const t2 = setTimeout(() => setPhase("cracking"), 1650);
      const t3 = setTimeout(() => setPhase("exploding"), 2250);
      const t4 = setTimeout(() => setPhase("revealed"), 2900);
      timers.current = [t1, t2, t3, t4];
    },
    [phase]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const { eggId } = (e as CustomEvent<{ eggId: string }>).detail;
      triggerEgg(eggId);
    };
    window.addEventListener("egg-found", handler);
    return () => window.removeEventListener("egg-found", handler);
  }, [triggerEgg]);

  const handleClaim = async () => {
    if (!userId) {
      setClaimResult({
        success: false,
        message: "Session expired — please refresh the page.",
      });
      return;
    }
    setPhase("claiming");
    const result = await claimEasterEgg(currentEggId, eventSlug);

    if (result.success) {
      foundThisSession.current.add(currentEggId);
      setPhase("flying");
      const t1 = setTimeout(() => setPhase("done"), 1300);
      const t2 = setTimeout(() => {
        setPhase("idle");
        setClaimResult(null);
      }, 3800);
      timers.current = [t1, t2];
    } else {
      setClaimResult({ success: false, message: result.message });
      setPhase("revealed");
    }
  };

  const handleClose = () => {
    clearAllTimers();
    setPhase("idle");
    setClaimResult(null);
  };

  if (phase === "idle") return null;

  const eggVisible = ["appearing", "shaking", "cracking"].includes(phase);
  const showExplosion = phase === "exploding";
  const cardVisible = ["revealed", "claiming"].includes(phase);
  const flyVisible = phase === "flying";
  const doneVisible = phase === "done";

  return (
    <>
      <style>{`
        @keyframes egg-drop-in {
          0%   { transform: translateY(-420px) scale(0.55) rotate(-8deg); opacity: 0; }
          55%  { transform: translateY(22px)   scale(1.07) rotate(4deg);  opacity: 1; }
          72%  { transform: translateY(-14px)  scale(0.97) rotate(-1.5deg); }
          85%  { transform: translateY(7px)    scale(1.02) rotate(0.5deg); }
          100% { transform: translateY(0)      scale(1)    rotate(0deg);   opacity: 1; }
        }
        @keyframes egg-shake-anim {
          0%,100% { transform: rotate(0deg) scale(1); }
          10% { transform: rotate(-13deg) scale(1.03); }
          25% { transform: rotate(13deg)  scale(0.97); }
          40% { transform: rotate(-9deg)  scale(1.02); }
          55% { transform: rotate(9deg)   scale(0.98); }
          68% { transform: rotate(-5deg); }
          80% { transform: rotate(5deg);  }
          90% { transform: rotate(-2deg); }
        }
        @keyframes egg-crack-1 {
          from { stroke-dashoffset: 130; }
          to   { stroke-dashoffset: 0;   }
        }
        @keyframes egg-crack-2 {
          from { stroke-dashoffset: 45; }
          to   { stroke-dashoffset: 0;  }
        }
        @keyframes egg-crack-3 {
          from { stroke-dashoffset: 30; }
          to   { stroke-dashoffset: 0;  }
        }
        @keyframes egg-explode-out {
          0%   { transform: scale(1);   opacity: 1; }
          25%  { transform: scale(1.35); opacity: 1; }
          55%  { transform: scale(0.92); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes particle-burst {
          0%   { transform: translate(0,0) scale(1) rotate(0deg);   opacity: 1; }
          100% { transform: translate(var(--tx),var(--ty)) scale(0) rotate(200deg); opacity: 0; }
        }
        @keyframes spark-ring {
          0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 0; }
          40%  { transform: translate(-50%,-50%) scale(1.1); opacity: 0.9; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
        @keyframes card-rise {
          0%   { transform: translateY(55px) scale(0.88); opacity: 0; }
          58%  { transform: translateY(-10px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0)     scale(1);    opacity: 1; }
        }
        @keyframes card-pulse-glow {
          0%,100% { box-shadow: 0 0 24px rgba(255,255,255,0.12), 0 24px 64px rgba(0,0,0,0.65); }
          50%     { box-shadow: 0 0 60px rgba(255,255,255,0.28), 0 0 110px rgba(255,255,255,0.08), 0 24px 64px rgba(0,0,0,0.65); }
        }
        @keyframes fly-to-nav {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50vw + 48px), calc(50vh - 48px)) scale(0.12); opacity: 0; }
        }
        @keyframes done-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          55%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes star-spin {
          0%,100% { transform: scale(1) rotate(0deg);   opacity: 1; }
          50%     { transform: scale(1.5) rotate(180deg); opacity: 0.7; }
        }
        @keyframes shimmer-bar {
          0%   { background-position: -200% 0; }
          100% { background-position: 200%  0; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center"
        style={{
          background: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          animation: "overlay-in 0.35s ease-out forwards",
        }}
        onClick={cardVisible ? handleClose : undefined}
      >
        <div
          className="relative flex flex-col items-center gap-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Egg phases ── */}
          {eggVisible && (
            <div
              className="relative"
              style={{
                animation:
                  phase === "appearing"
                    ? "egg-drop-in 0.95s cubic-bezier(0.34,1.56,0.64,1) forwards"
                    : phase === "shaking"
                    ? "egg-shake-anim 0.65s ease-in-out infinite"
                    : "egg-shake-anim 0.22s ease-in-out 4",
              }}
            >
              <EggSVG />
              {phase === "cracking" && <CrackSVG />}
            </div>
          )}

          {/* ── Explosion ── */}
          {showExplosion && (
            <div className="relative" style={{ width: 156, height: 204 }}>
              {/* Egg scale-explodes */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  animation: "egg-explode-out 0.65s ease-out forwards",
                }}
              >
                <EggSVG />
                <CrackSVG />
              </div>

              {/* Sparkle ring */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.6)",
                  animation: "spark-ring 0.75s ease-out forwards",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.35)",
                  animation: "spark-ring 0.75s 0.1s ease-out forwards",
                }}
              />

              {/* Particles */}
              {PARTICLES.map((p) => {
                const rad = (p.angle * Math.PI) / 180;
                const tx = Math.cos(rad) * p.distance;
                const ty = Math.sin(rad) * p.distance;
                return (
                  <div
                    key={p.id}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: p.size,
                      height: p.isRect ? p.size * 0.5 : p.size,
                      backgroundColor: p.color,
                      borderRadius: p.isRect ? "2px" : "50%",
                      ["--tx" as string]: `${tx}px`,
                      ["--ty" as string]: `${ty}px`,
                      animation: `particle-burst 0.85s ${p.delay}s ease-out forwards`,
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* ── Credit Card ── */}
          {cardVisible && (
            <div
              style={{
                animation: "card-rise 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards",
              }}
            >
              <div
                className="rounded-[32px] border border-white/10 text-center"
                style={{
                  width: 310,
                  padding: "32px 28px",
                  background: "linear-gradient(145deg, #0e0e1c 0%, #08080f 100%)",
                  animation: "card-pulse-glow 2.2s ease-in-out infinite",
                }}
              >
                {/* Stars */}
                <div className="flex justify-center gap-3 mb-6" style={{ fontSize: 20 }}>
                  {["✦", "★", "✦"].map((s, i) => (
                    <span
                      key={i}
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        animation: `star-spin 1.8s ${i * 0.35}s ease-in-out infinite`,
                        display: "inline-block",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Labels */}
                <div className="space-y-1 mb-6">
                  <p
                    className="text-[11px] uppercase font-bold tracking-[0.35em]"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    🥚 Easter Egg Found!
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-medium">
                    {EGG_LABELS[currentEggId] ?? "Hidden Secret"}
                  </p>
                </div>

                {/* Amount */}
                <div className="py-4 mb-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div
                    className="text-[72px] font-extralight leading-none"
                    style={{
                      background: "linear-gradient(135deg, #ffffff, #aaaaaa)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    $50
                  </div>
                  <p className="text-sm text-gray-400 font-light mt-1">Cursor Credit</p>
                </div>

                {/* Shimmer bar decoration */}
                <div
                  className="h-[1px] w-full mb-6 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), rgba(200,200,200,0.4), transparent)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer-bar 2s linear infinite",
                  }}
                />

                {/* Claim result / buttons */}
                {claimResult ? (
                  <div className="space-y-4">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        claimResult.success ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {claimResult.message}
                    </p>
                    <button
                      onClick={handleClose}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      close
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleClaim}
                      disabled={phase === "claiming"}
                      className="w-full py-4 rounded-2xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{
                        background: "rgba(255,255,255,0.95)",
                        color: "#000000",
                        boxShadow: "0 8px 32px rgba(255,255,255,0.18)",
                      }}
                    >
                      {phase === "claiming" ? "✨ Claiming..." : "→ Claim My $50 Credit"}
                    </button>
                    <button
                      onClick={handleClose}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors block w-full"
                    >
                      maybe later
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Flying to nav ── */}
          {flyVisible && (
            <div style={{ animation: "fly-to-nav 1.15s cubic-bezier(0.4,0,0.2,1) forwards" }}>
              <div
                className="rounded-2xl border border-white/20 text-center px-8 py-5"
                style={{ background: "linear-gradient(135deg, #1a1a1a, #080808)" }}
              >
                <div
                  className="text-4xl font-extralight"
                  style={{
                    background: "linear-gradient(135deg, #ffffff, #aaaaaa)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  $50
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Credit</p>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {doneVisible && (
            <div
              className="text-center space-y-4"
              style={{ animation: "done-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
            >
              <div style={{ fontSize: 72 }}>🎉</div>
              <div className="space-y-2">
                <p className="text-white text-2xl font-light tracking-tight">Credit Added!</p>
                <p className="text-sm text-gray-400 font-light">
                  Check the Credits tab in Event
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
