"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  RefreshCw,
  X,
  Zap,
  AlertTriangle,
  Info,
  Megaphone,
  Timer,
  BarChart2,
  Phone,
  CheckCircle,
} from "lucide-react";
import type { Event } from "@/types";
import type { Recommendation, OpsMetrics } from "@/lib/actions/copilot";
import { getOpsRecommendations, sendStaffAlertSMS } from "@/lib/actions/copilot";
import { startTimer } from "@/lib/actions/timer";
import { cn } from "@/lib/utils";

interface CopilotTabProps {
  event: Event;
  adminCode: string;
}

const POLL_INTERVAL_MS = 30_000;

const SEVERITY = {
  info: {
    badge: "bg-white/10 text-white/50",
    border: "border-white/[0.06]",
    Icon: Info,
  },
  warn: {
    badge: "bg-amber-500/20 text-amber-400",
    border: "border-amber-500/20",
    Icon: AlertTriangle,
  },
  urgent: {
    badge: "bg-red-500/20 text-red-400",
    border: "border-red-500/20",
    Icon: Zap,
  },
} as const;

const ACTION_ICON = {
  announcement: Megaphone,
  timer: Timer,
  poll_nudge: BarChart2,
  staff_alert: Phone,
};

export function CopilotTab({ event, adminCode }: CopilotTabProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [metrics, setMetrics] = useState<OpsMetrics | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [actionResults, setActionResults] = useState<Record<string, string>>({});

  const fetchRecommendations = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const { recommendations: recs, metrics: m } = await getOpsRecommendations(event.id);
      setRecommendations(recs);
      setMetrics(m);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("[CopilotTab]", err);
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    fetchRecommendations(true);
    const interval = setInterval(() => fetchRecommendations(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchRecommendations]);

  const dismiss = (signalKey: string) => {
    setDismissedKeys((prev) => new Set([...Array.from(prev), signalKey]));
  };

  const executeAction = async (rec: Recommendation) => {
    if (!rec.action || executingAction) return;
    setExecutingAction(rec.signalKey);

    try {
      const { type, payload } = rec.action;

      if (type === "announcement" || type === "poll_nudge") {
        const content = payload.content || rec.headline;
        const res = await fetch("/api/announcements", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-code": adminCode,
            "x-event-id": event.id,
          },
          body: JSON.stringify({ eventId: event.id, content }),
        });
        if (res.ok) {
          setActionResults((prev) => ({ ...prev, [rec.signalKey]: "Announcement sent" }));
          dismiss(rec.signalKey);
        } else {
          setActionResults((prev) => ({ ...prev, [rec.signalKey]: "Failed to send" }));
        }
      } else if (type === "timer") {
        const duration = payload.durationMinutes || 5;
        const result = await startTimer(event.id, rec.headline, duration, adminCode);
        if ("error" in result) {
          setActionResults((prev) => ({ ...prev, [rec.signalKey]: result.error || "Failed" }));
        } else {
          setActionResults((prev) => ({
            ...prev,
            [rec.signalKey]: `${duration}min timer started`,
          }));
          dismiss(rec.signalKey);
        }
      } else if (type === "staff_alert") {
        const result = await sendStaffAlertSMS(
          `${rec.headline} — ${rec.detail}`,
          event.id
        );
        if (result.success) {
          setActionResults((prev) => ({
            ...prev,
            [rec.signalKey]: `SMS sent to ${result.sent} admin${result.sent !== 1 ? "s" : ""}`,
          }));
          dismiss(rec.signalKey);
        } else {
          setActionResults((prev) => ({
            ...prev,
            [rec.signalKey]: result.error || "SMS failed",
          }));
        }
      }
    } catch (err) {
      setActionResults((prev) => ({ ...prev, [rec.signalKey]: "Action failed" }));
      console.error("[CopilotTab] action error:", err);
    } finally {
      setExecutingAction(null);
    }
  };

  const visible = recommendations.filter((r) => !dismissedKeys.has(r.signalKey));
  const urgentCount = visible.filter((r) => r.severity === "urgent").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-[28px] px-7 py-5 border-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white/60" />
          </div>
          <div>
            <p className="text-sm font-light text-white/80">Ops Copilot</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mt-0.5">
              {loading
                ? "Scanning..."
                : lastRefresh
                ? `Last scan ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Idle"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {urgentCount > 0 && (
            <span className="text-[10px] font-medium px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20 animate-pulse">
              {urgentCount} URGENT
            </span>
          )}
          <button
            onClick={() => fetchRecommendations(true)}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("w-4 h-4 text-white/40", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Metrics strip */}
      {metrics && (
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Checked In",
              value: `${metrics.checkedIn} / ${metrics.totalRegistered}`,
              sub:
                metrics.totalRegistered > 0
                  ? `${Math.round((metrics.checkedIn / metrics.totalRegistered) * 100)}%`
                  : "—",
            },
            {
              label: "Open Q&A",
              value: metrics.openQuestions.length,
              sub:
                metrics.openQuestions.length > 0
                  ? `oldest ${metrics.openQuestions[0].ageMinutes}m ago`
                  : "all clear",
            },
            {
              label: "Help Queue",
              value: metrics.waitingHelpRequests.length,
              sub:
                metrics.waitingHelpRequests.length > 0
                  ? `oldest ${metrics.waitingHelpRequests[0].ageMinutes}m ago`
                  : "clear",
            },
            {
              label: "Active Polls",
              value: metrics.activePolls.length,
              sub:
                metrics.activePolls.length > 0
                  ? metrics.activePolls.map((p) => `${p.votePercent}%`).join(", ") + " voted"
                  : "none running",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="glass rounded-[20px] px-4 py-4 border-white/[0.03] text-center"
            >
              <p className="text-xl font-light text-white/90">{stat.value}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 font-medium mt-1">
                {stat.label}
              </p>
              <p className="text-[9px] text-gray-700 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {loading && recommendations.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="w-10 h-10 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-700">Scanning event...</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="glass rounded-[40px] p-12 text-center border-white/[0.03]">
          <CheckCircle className="w-8 h-8 text-white/10 mx-auto mb-4" />
          <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-700 mb-2">
            All Clear
          </p>
          <p className="text-[9px] text-gray-800 tracking-tight">
            No issues detected. Copilot scans automatically every 30 seconds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((rec) => {
            const { badge, border, Icon } = SEVERITY[rec.severity];
            const ActionIcon = rec.action ? ACTION_ICON[rec.action.type] : null;
            const result = actionResults[rec.signalKey];
            const isExecuting = executingAction === rec.signalKey;

            return (
              <div
                key={rec.signalKey}
                className={cn(
                  "glass rounded-[32px] p-7 border transition-all animate-fade-in",
                  border
                )}
              >
                <div className="flex items-start gap-5">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                      badge
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span
                          className={cn(
                            "text-[9px] uppercase tracking-[0.2em] font-medium px-2 py-0.5 rounded-full",
                            badge
                          )}
                        >
                          {rec.severity} · {rec.signal.replace(/_/g, " ")}
                        </span>
                        <p className="text-white/90 font-light mt-2 text-sm leading-snug">
                          {rec.headline}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                          {rec.detail}
                        </p>
                      </div>
                      <button
                        onClick={() => dismiss(rec.signalKey)}
                        className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0 mt-0.5"
                      >
                        <X className="w-3 h-3 text-white/30" />
                      </button>
                    </div>

                    {result ? (
                      <div className="mt-4 flex items-center gap-2 text-[11px] text-white/40">
                        <CheckCircle className="w-3.5 h-3.5 text-white/30" />
                        {result}
                      </div>
                    ) : rec.action && ActionIcon ? (
                      <button
                        onClick={() => executeAction(rec)}
                        disabled={executingAction !== null}
                        className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-xs font-medium hover:scale-[1.02] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                      >
                        {isExecuting ? (
                          <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <ActionIcon className="w-3.5 h-3.5" />
                        )}
                        {rec.action.label}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
