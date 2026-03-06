"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ExternalLink, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { markCreditRedeemed } from "@/lib/actions/cursor-credits";
import type { CursorCredit } from "@/types";

const REDEMPTION_URL = (code: string) => `https://cursor.com/referral?code=${code}`;

interface AttendeeCreditsViewProps {
  credit: CursorCredit | null;
  userId: string;
}

export function AttendeeCreditsView({ credit, userId }: AttendeeCreditsViewProps) {
  const [copied, setCopied] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [redeemed, setRedeemed] = useState<string | null>(credit?.redeemed_at ?? null);
  const [markingRedeemed, setMarkingRedeemed] = useState(false);

  if (!credit) {
    return (
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
    );
  }

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
    if (!result.error) {
      setRedeemed(new Date().toISOString());
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* QR code + redeem options */}
      <div className="glass rounded-[32px] p-8 border border-white/10 flex flex-col items-center gap-6">
        <div className="rounded-2xl overflow-hidden bg-white p-3">
          <QRCodeSVG
            value={url}
            size={200}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
          />
        </div>
        <p className="text-xs text-gray-500 text-center">
          Scan with your phone&apos;s camera to open the redemption page
        </p>

        {/* OR divider */}
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

      {/* Code + copy */}
      <div className="glass rounded-2xl p-5 border border-white/10 flex items-center gap-4">
        <code className="flex-1 font-mono text-lg text-white tracking-widest truncate">
          {credit.credit_code}
        </code>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white hover:bg-white/20 transition-all flex-shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Instructions accordion */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        <button
          onClick={() => setInstructionsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <span className="text-sm text-white/70">How to redeem</span>
          {instructionsOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
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
                <span className="text-[10px] font-medium text-gray-600 mt-0.5 flex-shrink-0 w-4 text-right">
                  {i + 1}.
                </span>
                <p className="text-sm text-gray-400">{step}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redeemed toggle */}
      <div className="flex items-center justify-end">
        {redeemed ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-400/10 border border-green-400/20">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Redeemed</span>
            <span className="text-xs text-green-600">
              {new Date(redeemed).toLocaleDateString()}
            </span>
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
