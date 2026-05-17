"use client";

import { useEffect, useState, useMemo } from "react";

interface ConfettiProps {
  duration?: number; // Duration in milliseconds
  particleCount?: number;
}

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  size: number;
  drift: number;
}

const colors = [
  "#FFD700", // Gold
  "#FFA500", // Orange
  "#FF6B6B", // Coral
  "#4ECDC4", // Teal
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage
  "#FFEAA7", // Light Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Soft Yellow
];

export function Confetti({ duration = 20000, particleCount = 100 }: ConfettiProps) {
  const [isVisible, setIsVisible] = useState(true);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 3,
      rotation: Math.random() * 360,
      size: Math.random() * 8 + 4,
      drift: (Math.random() - 0.5) * 100,
    }));
  }, [particleCount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  return (
    <div className="confetti-container">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="confetti-piece"
          style={{
            left: `${particle.x}%`,
            backgroundColor: particle.color,
            width: `${particle.size}px`,
            height: `${particle.size * 0.6}px`,
            animationDelay: `${particle.delay}s`,
            transform: `rotate(${particle.rotation}deg)`,
            "--drift": `${particle.drift}px`,
          } as React.CSSProperties}
        />
      ))}
      <style jsx>{`
        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 50;
          border-radius: inherit;
        }

        .confetti-piece {
          position: absolute;
          top: -20px;
          border-radius: 2px;
          animation: confetti-fall 4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) translateX(0) rotate(0deg);
            opacity: 1;
          }
          25% {
            opacity: 1;
          }
          100% {
            transform: translateY(400px) translateX(var(--drift)) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export function CreditsStream({ duration = 20000 }: { duration?: number }) {
  const [isVisible, setIsVisible] = useState(true);

  const items = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const type = Math.random() > 0.5 ? 'coin' : 'credit';
      const direction = Math.random() > 0.5 ? 'vertical' : 'horizontal';
      return {
        id: i,
        type,
        direction,
        pos: Math.random() * 100,
        delay: Math.random() * 20, // 0-20s delay
        duration: Math.random() * 6 + 10, // 10-16s to cross (slower)
        rotation: Math.random() * 360,
        scale: Math.random() * 0.4 + 0.8,
      };
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden rounded-[inherit]">
      {items.map((item) => (
        <div
          key={item.id}
          className={`credit-item ${item.direction}`}
          style={{
            ...(item.direction === 'vertical' ? { left: `${item.pos}%` } : { top: `${item.pos}%` }),
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`,
            '--scale': item.scale,
            '--rotation': `${item.rotation}deg`,
          } as React.CSSProperties}
        >
          {item.type === 'coin' ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 border-[3px] border-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.6),inset_0_0_10px_rgba(255,255,255,0.5)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-yellow-500/50 bg-gradient-to-br from-yellow-300 to-yellow-500">
                <span className="text-2xl font-black text-yellow-100 drop-shadow-md">C</span>
              </div>
            </div>
          ) : (
            <div className="flex h-12 px-5 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gray-900 to-black border border-gray-700 shadow-[0_0_20px_rgba(255,255,255,0.15)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/>
              </svg>
              <span className="text-sm font-black tracking-widest text-white drop-shadow-md">CURSOR CREDIT</span>
            </div>
          )}
        </div>
      ))}
      <style jsx>{`
        .credit-item {
          position: absolute;
          opacity: 0;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .vertical {
          top: -100px;
          animation-name: credit-fall;
        }

        .horizontal {
          left: -200px;
          animation-name: credit-cross;
        }

        @keyframes credit-fall {
          0% {
            transform: translateY(-100px) scale(var(--scale)) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(120vh) scale(var(--scale)) rotate(calc(var(--rotation) + 360deg));
            opacity: 0;
          }
        }

        @keyframes credit-cross {
          0% {
            transform: translateX(-200px) scale(var(--scale)) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(120vw) scale(var(--scale)) rotate(calc(var(--rotation) + 360deg));
            opacity: 0;
          }
        }

        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

export function WinnerCelebration({ duration = 20000 }: { duration?: number }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  return (
    <>
      <Confetti duration={duration} particleCount={80} />
      <CreditsStream duration={duration} />
      {/* Sparkle effects */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden rounded-[inherit]">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="sparkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        .sparkle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: white;
          border-radius: 50%;
          animation: sparkle 1.5s ease-in-out infinite;
          box-shadow: 0 0 6px 2px rgba(255, 215, 0, 0.8),
                      0 0 12px 4px rgba(255, 165, 0, 0.4);
        }

        @keyframes sparkle {
          0%, 100% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
