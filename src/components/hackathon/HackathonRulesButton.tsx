"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

const JUDGING_PHASES = [
  {
    label: "Phase 1",
    title: "Submit Your Project",
    points: [
      "Go to Hackathon -> Teams -> Submit Project.",
      "Add your project name, description, and public GitHub repo URL.",
      "Upload up to 5 screenshots. These are used for AI visual review.",
      "Add a demo URL if you have one.",
      "You can update your submission anytime before the deadline.",
    ],
  },
  {
    label: "Phase 2",
    title: "AI Screening",
    points: [
      "After build time, admins run Claude AI analysis on all projects.",
      "Claude runs 6 passes: repo structure, code quality, innovation, visual UX, pool comparison, and final synthesis.",
      "Analysis takes about 3 minutes per team. You will see live progress on your dashboard.",
      "Projects are scored across 6 weighted criteria.",
      "Problem-Solution Fit is judged against the event prompt and whether the project solves a real personal pain point.",
      "You will NOT see your AI score. Results stay pending until admin review.",
    ],
  },
  {
    label: "Phase 3",
    title: "Final Round Judging",
    points: [
      "Top 8 AI-scored teams advance to the Final Round.",
      "Human judges review each project and add their own scores.",
      "AI scores are shown to judges as reference, not as final marks.",
      "Aggregate standings are calculated from human judge scorecards.",
    ],
  },
  {
    label: "Phase 4",
    title: "Results",
    points: [
      "Admin publishes the Top 3, visible on the Competitions page.",
      "Leaderboard becomes visible once admin approves scores.",
      "Winners are announced in the #announcements channel.",
    ],
  },
];

const SCORING_CRITERIA = [
  {
    name: "Innovation & Originality",
    weight: "25%",
    description: "How novel and surprising is the concept?",
  },
  {
    name: "Technical Execution",
    weight: "25%",
    description: "Cleverness of the engineering.",
  },
  {
    name: "Functional Completeness",
    weight: "20%",
    description: "Does the core loop actually work?",
  },
  {
    name: "Problem-Solution Fit",
    weight: "20%",
    description: "Solving a real personal pain point in line with the event prompt.",
  },
  {
    name: "UX & Design",
    weight: "5%",
    description: "Visual polish and usability.",
  },
  {
    name: "Learning & Ambition",
    weight: "5%",
    description: "Did the team stretch themselves?",
  },
];

interface HackathonRulesButtonProps {
  className?: string;
  compact?: boolean;
}

export function HackathonRulesButton({ className, compact = false }: HackathonRulesButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 font-bold uppercase tracking-[0.16em] text-white transition-all hover:border-white/30 hover:bg-white/20",
          compact ? "px-4 py-2 text-[10px]" : "px-5 py-3 text-[11px]",
          className
        )}
      >
        <BookOpen className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        Rules
      </button>

      {isOpen && <HackathonRulesModal onClose={() => setIsOpen(false)} />}
    </>
  );
}

function HackathonRulesModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEsc);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex min-h-screen items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="hackathon-rules-title"
        className="relative z-10 my-8 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#080808]/95 shadow-[0_30px_80px_rgba(0,0,0,0.85)]"
      >
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/10 bg-black/80 px-5 py-5 backdrop-blur-xl sm:px-7">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-red-300">
              Hackathon
            </p>
            <h2 id="hackathon-rules-title" className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Rules
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
              Judging Process: how projects are evaluated, from submission to final results.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-6 sm:px-7">
          <div className="grid gap-4">
            {JUDGING_PHASES.map((phase) => (
              <article
                key={phase.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-red-200">
                    {phase.label}
                  </span>
                  <h3 className="text-lg font-bold text-white">{phase.title}</h3>
                </div>
                <ul className="space-y-2.5 text-sm leading-6 text-gray-300">
                  {phase.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-7 rounded-[28px] border border-red-400/20 bg-red-500/[0.04] p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-300">
                  Scoring Criteria
                </p>
                <h3 className="mt-2 text-xl font-black text-white">Weighted Rubric</h3>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
                Total: 100%
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SCORING_CRITERIA.map((criterion) => (
                <div
                  key={criterion.name}
                  className="rounded-[20px] border border-white/10 bg-black/30 p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <h4 className="font-bold text-white">{criterion.name}</h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-black">
                      {criterion.weight}
                    </span>
                  </div>
                  <p className="text-sm leading-5 text-gray-400">{criterion.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">
              Tips
            </p>
            <p className="text-sm leading-6 text-gray-300">
              <strong className="font-black text-white">MAKE YOUR REPO PUBLIC BEFORE SUBMISSION.</strong>{" "}
              Upload screenshots because they directly affect
              your visual score. Keep your pitch text concise and clear about what problem you are solving.
            </p>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
