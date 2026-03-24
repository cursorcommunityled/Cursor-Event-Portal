"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { Copy, Check, ExternalLink, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { markCreditRedeemed } from "@/lib/actions/cursor-credits";
import type { CursorCredit } from "@/types";
import { cn } from "@/lib/utils";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

const REDEMPTION_URL = (code: string) => `https://cursor.com/referral?code=${code}`;
const EASTER_EVENT_SLUG = "calgary-march-2026";
const TOTAL_EGGS = 3;

function isEasterCredit(credit: CursorCredit) {
  return credit.amount_usd === 50;
}

// ── Egg tally ──────────────────────────────────────────────────────────────────

function EggTally({ foundCount, eventId }: { foundCount: number; eventId: string }) {
  const [globalCount, setGlobalCount] = useState(foundCount);

  // Fetch current global claim count on mount
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("easter_egg_hunts")
      .select("egg_id", { count: "exact" })
      .eq("event_id", eventId)
      .not("claimed_by", "is", null)
      .then(({ count }) => {
        if (count !== null) setGlobalCount(count);
      });
  }, [eventId]);

  // Listen for new claims broadcast by EasterEggOverlay
  useEffect(() => {
    const handler = () => setGlobalCount((n) => Math.min(n + 1, TOTAL_EGGS));
    window.addEventListener("egg-globally-claimed", handler);
    return () => window.removeEventListener("egg-globally-claimed", handler);
  }, []);

  return (
    <div className="glass rounded-[32px] p-6 border border-white/10">
      <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-medium mb-5 text-center">
        Easter Egg Hunt
      </p>
      <div className="flex items-center justify-center gap-6">
        {Array.from({ length: TOTAL_EGGS }, (_, i) => {
          const found = i < globalCount;
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "relative transition-all duration-500",
                  found ? "drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" : "opacity-30"
                )}
              >
                <svg viewBox="0 0 100 130" width="56" height="73" xmlns="http://www.w3.org/2000/svg">
                  {found ? (
                    <>
                      <defs>
                        <linearGradient id={`egg-fill-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#1c1c1c" />
                          <stop offset="100%" stopColor="#050505" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M50 5 C22 5 5 40 5 68 C5 103 22 128 50 128 C78 128 95 103 95 68 C95 40 78 5 50 5Z"
                        fill={`url(#egg-fill-${i})`}
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth="2"
                      />
                      <image
                        href="/cursor-logo.jpeg"
                        x="22"
                        y="42"
                        width="56"
                        height="56"
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </>
                  ) : (
                    <path
                      d="M50 5 C22 5 5 40 5 68 C5 103 22 128 50 128 C78 128 95 103 95 68 C95 40 78 5 50 5Z"
                      fill="none"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="3"
                      strokeDasharray="8 5"
                    />
                  )}
                </svg>
              </div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                {found ? "Found" : "Hidden"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-gray-600 mt-5">
        {globalCount === 0
          ? "3 eggs hidden — find them all for $50 each"
          : globalCount === TOTAL_EGGS
          ? "🎉 All eggs found!"
          : `${globalCount} of ${TOTAL_EGGS} found · keep hunting`}
      </p>
    </div>
  );
}

// ── Single easter egg credit card ──────────────────────────────────────────────

function EasterCreditCard({ credit, userId }: { credit: CursorCredit; userId: string }) {
  const [copied, setCopied] = useState(false);
  const [redeemed, setRedeemed] = useState<string | null>(credit.redeemed_at ?? null);
  const [markingRedeemed, setMarkingRedeemed] = useState(false);

  const isPending = credit.credit_code.startsWith("EASTER_");
  const url = isPending ? "" : REDEMPTION_URL(credit.credit_code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(credit.credit_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleMarkRedeemed = async () => {
    setMarkingRedeemed(true);
    const result = await markCreditRedeemed(credit.id, userId);
    setMarkingRedeemed(false);
    if (!result.error) setRedeemed(new Date().toISOString());
  };

  return (
    <div className="glass rounded-[32px] p-6 border border-white/10 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🥚</span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Easter Egg</p>
            <p className="text-lg font-light text-white">$50 Cursor Credit</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm text-white font-medium">
          $50 USD
        </span>
      </div>

      {isPending ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Your $50 credit code will appear here shortly — we&apos;re assigning your referral link now.
          </p>
        </div>
      ) : (
        <>
          <div className="glass rounded-[24px] p-6 border border-white/10 flex flex-col items-center gap-5">
            <div className="rounded-2xl overflow-hidden bg-white p-3">
              <QRCodeSVG value={url} size={160} bgColor="#ffffff" fgColor="#000000" level="M" />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Scan with your phone&apos;s camera to redeem
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-all shadow-[0_2px_20px_rgba(255,255,255,0.15)]"
            >
              <ExternalLink className="w-4 h-4" />
              Click Here to Redeem
            </a>
          </div>

          <div className="glass rounded-2xl p-4 border border-white/10 flex items-center gap-3">
            <code className="flex-1 font-mono text-base text-white tracking-widest truncate">
              {credit.credit_code}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white hover:bg-white/20 transition-all flex-shrink-0"
            >
              {copied ? (
                <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></>
              ) : (
                <><Copy className="w-4 h-4" />Copy</>
              )}
            </button>
          </div>
        </>
      )}

      <div className="flex items-center justify-end">
        {redeemed ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-400/10 border border-green-400/20">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Redeemed</span>
          </div>
        ) : !isPending ? (
          <button
            onClick={handleMarkRedeemed}
            disabled={markingRedeemed}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
          >
            {markingRedeemed ? "Saving…" : "Mark as Redeemed"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Sponsor credit card ($20) ──────────────────────────────────────────────────

function SponsorCreditCard({ credit, userId }: { credit: CursorCredit; userId: string }) {
  const [copied, setCopied] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [redeemed, setRedeemed] = useState<string | null>(credit.redeemed_at ?? null);
  const [markingRedeemed, setMarkingRedeemed] = useState(false);

  const url = REDEMPTION_URL(credit.credit_code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(credit.credit_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleMarkRedeemed = async () => {
    setMarkingRedeemed(true);
    const result = await markCreditRedeemed(credit.id, userId);
    setMarkingRedeemed(false);
    if (!result.error) setRedeemed(new Date().toISOString());
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-medium">
            Sponsor Credit
          </p>
          <h2 className="text-2xl font-light text-white mt-0.5">$20 Cursor Credit</h2>
        </div>
        <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm text-white font-medium">
          ${credit.amount_usd} USD
        </span>
      </div>

      <div className="glass rounded-[32px] p-8 border border-white/10 flex flex-col items-center gap-6">
        <div className="rounded-2xl overflow-hidden bg-white p-3">
          <QRCodeSVG value={url} size={200} bgColor="#ffffff" fgColor="#000000" level="M" />
        </div>
        <p className="text-xs text-gray-500 text-center">
          Scan with your phone&apos;s camera to open the redemption page
        </p>
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-medium">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-all shadow-[0_2px_20px_rgba(255,255,255,0.15)]"
        >
          <ExternalLink className="w-4 h-4" />
          Click Here to Redeem
        </a>
      </div>

      <div className="glass rounded-2xl p-5 border border-white/10 flex items-center gap-4">
        <code className="flex-1 font-mono text-lg text-white tracking-widest truncate">
          {credit.credit_code}
        </code>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white hover:bg-white/20 transition-all flex-shrink-0"
        >
          {copied ? (
            <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></>
          ) : (
            <><Copy className="w-4 h-4" />Copy</>
          )}
        </button>
      </div>

      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        <button
          onClick={() => setInstructionsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <span className="text-sm text-white/70">How to redeem</span>
          {instructionsOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {instructionsOpen && (
          <div className="px-5 pb-5 space-y-2 border-t border-white/[0.06] pt-4">
            {[
              "Open cursor.com in your browser",
              "Sign in to your Cursor account (or create one)",
              "Scan the QR code above or click Redeem Now",
              "Credits are applied automatically to your account",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-[10px] font-medium text-gray-600 mt-0.5 flex-shrink-0 w-4 text-right">{i + 1}.</span>
                <p className="text-sm text-gray-400">{step}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end">
        {redeemed ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-400/10 border border-green-400/20">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Redeemed</span>
            <span className="text-xs text-green-600">{new Date(redeemed).toLocaleDateString()}</span>
          </div>
        ) : (
          <button
            onClick={handleMarkRedeemed}
            disabled={markingRedeemed}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
          >
            {markingRedeemed ? "Saving…" : "Mark as Redeemed"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

interface AttendeeCreditsViewProps {
  credits: CursorCredit[];
  userId: string;
  eventSlug: string;
  eventId: string;
}

export function AttendeeCreditsView({ credits, userId, eventSlug, eventId }: AttendeeCreditsViewProps) {
  const easterCredits = credits.filter(isEasterCredit);
  const sponsorCredits = credits.filter((c) => !isEasterCredit(c));
  const sponsorCredit = sponsorCredits[0] ?? null;
  const isEasterEvent = eventSlug === EASTER_EVENT_SLUG;

  return (
    <div className="space-y-6">
      {/* Egg tally — only for easter event */}
      {isEasterEvent && <EggTally foundCount={easterCredits.length} eventId={eventId} />}

      {/* Easter egg credits */}
      {easterCredits.map((c) => (
        <EasterCreditCard key={c.id} credit={c} userId={userId} />
      ))}

      {/* Sponsor credit */}
      {sponsorCredit ? (
        <SponsorCreditCard credit={sponsorCredit} userId={userId} />
      ) : (
        <div className="glass rounded-[32px] p-8 border border-white/10 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <p className="text-white font-light text-lg">$20 Cursor Credit</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">
              Your credit will appear here once you&apos;re checked in at the event.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
