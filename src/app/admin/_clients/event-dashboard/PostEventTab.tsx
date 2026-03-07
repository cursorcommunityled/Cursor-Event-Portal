"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  getPostEventEmailStats,
  sendPostEventEmails,
  type PostEventEmailMode,
} from "@/lib/actions/post-event-emails";

interface PostEventTabProps {
  eventId: string;
  adminCode: string;
}

type ModeOption = {
  id: PostEventEmailMode;
  label: string;
  sublabel: string;
  description: string;
  icon: string;
};

const MODES: ModeOption[] = [
  {
    id: "host-blast",
    label: "Host Thank-You",
    sublabel: "Warm wrap-up from the organizer",
    description:
      "Sends a warm thank-you email to each attendee showing who they sat with and their profile links. Simple, friendly, no friction.",
    icon: "✉️",
  },
  {
    id: "survey",
    label: "Post-Event Survey",
    sublabel: "Feedback + group summary",
    description:
      "Same as the thank-you email but includes a prominent link to your survey. Ideal for collecting NPS or qualitative feedback right after the event.",
    icon: "📋",
  },
  {
    id: "connection-recommend",
    label: "Connection Intros",
    sublabel: "Personalized, transparent intros",
    description:
      "Each attendee receives a personalized email introducing their groupmates by name with the AI-generated match reason. Includes LinkedIn, GitHub, and website links. Only shares profiles of people who also consented.",
    icon: "🤝",
  },
];

export function PostEventTab({ eventId, adminCode }: PostEventTabProps) {
  const [selectedMode, setSelectedMode] = useState<PostEventEmailMode>("connection-recommend");
  const [surveyUrl, setSurveyUrl] = useState("");
  const [stats, setStats] = useState<{ groups: number; totalMembers: number; eligibleRecipients: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: number; errors: string[] } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setStatsLoading(true);
    setStatsError(null);
    getPostEventEmailStats(eventId, adminCode)
      .then((s) => {
        if (s.error) setStatsError(s.error);
        else setStats(s);
      })
      .finally(() => setStatsLoading(false));
  }, [eventId, adminCode]);

  async function handleSend() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const r = await sendPostEventEmails(eventId, adminCode, selectedMode, { surveyUrl });
      setResult(r);
    } finally {
      setSending(false);
      setConfirmed(false);
    }
  }

  const activeMode = MODES.find((m) => m.id === selectedMode)!;
  const canSend =
    !statsLoading &&
    !statsError &&
    stats !== null &&
    stats.eligibleRecipients > 0 &&
    (selectedMode !== "survey" || surveyUrl.trim().length > 0);

  return (
    <div className="space-y-8">
      {/* Stats bar */}
      <div className="glass rounded-2xl p-5 border border-white/10 grid grid-cols-3 gap-4 text-center">
        {statsLoading ? (
          <div className="col-span-3 flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : statsError ? (
          <div className="col-span-3 text-red-400 text-sm">{statsError}</div>
        ) : stats ? (
          <>
            <div>
              <p className="text-2xl font-light text-white">{stats.groups}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-medium mt-1">Approved Groups</p>
            </div>
            <div>
              <p className="text-2xl font-light text-white">{stats.totalMembers}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-medium mt-1">Total Attendees</p>
            </div>
            <div>
              <p className="text-2xl font-light text-white">{stats.eligibleRecipients}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-medium mt-1">Will Receive Email</p>
            </div>
          </>
        ) : null}
      </div>

      {stats && stats.eligibleRecipients === 0 && !statsLoading && (
        <p className="text-sm text-yellow-400/80 text-center">
          No eligible recipients — make sure there are approved groups and attendees have consented to follow-up emails.
        </p>
      )}

      {/* Mode selector */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Email Type</p>
        {MODES.map((mode) => {
          const isActive = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => { setSelectedMode(mode.id); setResult(null); setConfirmed(false); }}
              className={cn(
                "w-full text-left glass rounded-2xl p-5 border transition-all duration-200",
                isActive
                  ? "border-white/30 bg-white/[0.06]"
                  : "border-white/10 hover:border-white/20 hover:bg-white/[0.03]"
              )}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl mt-0.5">{mode.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{mode.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-gray-500 font-medium">{mode.sublabel}</span>
                    {isActive && (
                      <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-white/60 font-bold">Selected</span>
                    )}
                  </div>
                  {isActive && (
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">{mode.description}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Survey URL input */}
      {selectedMode === "survey" && (
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium block">
            Survey URL
          </label>
          <input
            type="url"
            value={surveyUrl}
            onChange={(e) => setSurveyUrl(e.target.value)}
            placeholder="https://forms.gle/... or https://typeform.com/..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      )}

      {/* Mode summary card */}
      {stats && stats.eligibleRecipients > 0 && (
        <div className="glass rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">What will be sent</p>
          <div className="text-sm text-gray-300 leading-relaxed space-y-1.5">
            {selectedMode === "host-blast" && (
              <>
                <p>• One email per eligible attendee ({stats.eligibleRecipients} total)</p>
                <p>• Each email lists their groupmates with available profile links</p>
                <p>• From: Cursor Pop-Up Portal</p>
              </>
            )}
            {selectedMode === "survey" && (
              <>
                <p>• One email per eligible attendee ({stats.eligibleRecipients} total)</p>
                <p>• Includes a prominent survey CTA button</p>
                <p>• Also lists groupmates with profile links</p>
                <p>• From: Cursor Pop-Up Portal</p>
              </>
            )}
            {selectedMode === "connection-recommend" && (
              <>
                <p>• One personalized email per eligible attendee ({stats.eligibleRecipients} total)</p>
                <p>• Shows each groupmate's name + AI match reason</p>
                <p>• Only reveals profiles of people who also consented</p>
                <p>• From: Cursor Pop-Up Portal</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={cn(
          "glass rounded-2xl p-5 border text-sm space-y-1.5",
          result.errors.length > 0 ? "border-yellow-400/20" : "border-green-400/20"
        )}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Send Result</p>
          <p className="text-green-400">✓ {result.sent} email{result.sent !== 1 ? "s" : ""} sent</p>
          {result.skipped > 0 && <p className="text-gray-400">↷ {result.skipped} skipped (no email or no consent)</p>}
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.errors.map((e, i) => (
                <p key={i} className="text-red-400 text-xs">✗ {e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Send button */}
      <div className="flex justify-end gap-3">
        {confirmed && !sending && (
          <button
            onClick={() => setConfirmed(false)}
            className="px-6 py-3 rounded-full text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={!canSend || sending}
          className={cn(
            "px-8 py-3 rounded-full text-sm font-medium transition-all duration-200",
            confirmed
              ? "bg-red-500 text-white hover:bg-red-400"
              : canSend
              ? "bg-white text-black hover:bg-white/90 shadow-glow"
              : "bg-white/10 text-gray-600 cursor-not-allowed"
          )}
        >
          {sending
            ? "Sending..."
            : confirmed
            ? `Confirm — send to ${stats?.eligibleRecipients ?? 0} people`
            : `Send ${activeMode.label} Emails`}
        </button>
      </div>
    </div>
  );
}
