"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  X,
  AlertTriangle,
  Info,
  Zap,
  Send,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOpsRecommendations } from "@/lib/actions/copilot";
import { adminChat } from "@/lib/actions/copilot-chat";
import type { Recommendation } from "@/lib/actions/copilot";
import type { ChatMessage } from "@/lib/actions/copilot-chat";

interface CopilotWidgetProps {
  eventId: string;
  adminCode: string;
}

type WidgetTab = "alerts" | "chat";

const SEVERITY_STYLE = {
  info: { dot: "bg-white/30", badge: "bg-white/10 text-white/50", Icon: Info },
  warn: { dot: "bg-amber-400", badge: "bg-amber-500/20 text-amber-400", Icon: AlertTriangle },
  urgent: { dot: "bg-red-400 animate-pulse", badge: "bg-red-500/20 text-red-400", Icon: Zap },
} as const;

export function CopilotWidget({ eventId, adminCode }: CopilotWidgetProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WidgetTab>("alerts");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAlerts = useCallback(async (showLoader = false) => {
    if (showLoader) setAlertsLoading(true);
    try {
      const { recommendations: recs } = await getOpsRecommendations(eventId);
      setRecommendations(recs);
    } catch {
      // silent
    } finally {
      setAlertsLoading(false);
    }
  }, [eventId]);

  // Poll alerts every 60s (widget is lighter than the full tab)
  useEffect(() => {
    fetchAlerts(true);
    const interval = setInterval(() => fetchAlerts(false), 60_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (open && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, activeTab]);

  // Focus input when chat tab opens
  useEffect(() => {
    if (open && activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, activeTab]);

  const visible = recommendations.filter((r) => !dismissed.has(r.signalKey));
  const urgentCount = visible.filter((r) => r.severity === "urgent").length;
  const warnCount = visible.filter((r) => r.severity === "warn").length;
  const totalAlerts = visible.length;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setChatLoading(true);

    const { reply, error } = await adminChat(eventId, adminCode, newMessages);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: error || reply },
    ]);
    setChatLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Popup panel */}
      {open && (
        <div className="fixed bottom-20 left-4 z-50 w-[380px] max-h-[600px] flex flex-col rounded-[28px] bg-[#0a0a0a] border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/90">Ops Copilot</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                  {totalAlerts > 0 ? `${totalAlerts} alert${totalAlerts !== 1 ? "s" : ""}` : "All clear"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAlerts(true)}
                disabled={alertsLoading}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-30"
              >
                <RefreshCw className={cn("w-3 h-3 text-white/40", alertsLoading && "animate-spin")} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3 text-white/40" />
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 px-4 py-3 border-b border-white/[0.06]">
            {(["alerts", "chat"] as WidgetTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-200",
                  activeTab === tab
                    ? "bg-white text-black"
                    : "text-gray-500 hover:text-white"
                )}
              >
                {tab === "alerts" ? `Alerts${totalAlerts > 0 ? ` (${totalAlerts})` : ""}` : "Chat"}
              </button>
            ))}
          </div>

          {/* Alerts tab */}
          {activeTab === "alerts" && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {alertsLoading && visible.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                </div>
              ) : visible.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-700 font-medium">All Clear</p>
                  <p className="text-[9px] text-gray-800 mt-1">No issues detected right now.</p>
                </div>
              ) : (
                visible.map((rec) => {
                  const { badge, dot, Icon } = SEVERITY_STYLE[rec.severity];
                  return (
                    <div
                      key={rec.signalKey}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", dot)} />
                      <div className="flex-1 min-w-0">
                        <span className={cn("text-[9px] uppercase tracking-[0.15em] font-medium px-2 py-0.5 rounded-full", badge)}>
                          {rec.severity}
                        </span>
                        <p className="text-xs text-white/80 font-light mt-1.5 leading-snug">{rec.headline}</p>
                        <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">{rec.detail}</p>
                      </div>
                      <button
                        onClick={() => setDismissed((prev) => new Set([...Array.from(prev), rec.signalKey]))}
                        className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0 mt-0.5"
                      >
                        <X className="w-2.5 h-2.5 text-white/20" />
                      </button>
                    </div>
                  );
                })
              )}
              {/* Link to full copilot */}
              <a
                href={`/admin/${adminCode}/social?tab=copilot`}
                className="flex items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-colors"
              >
                Full Copilot View
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Chat tab */}
          {activeTab === "chat" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: "400px" }}>
                {messages.length === 0 && (
                  <div className="py-6 text-center space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-700 font-medium">Ask me anything</p>
                    <p className="text-[9px] text-gray-800">I have full access to your event data right now.</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.role === "user"
                        ? "ml-auto bg-white text-black rounded-br-sm"
                        : "bg-white/[0.06] text-white/80 rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] rounded-2xl rounded-bl-sm max-w-[60%]">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your event..."
                  disabled={chatLoading}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-white/20 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || chatLoading}
                  className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-black" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-4 left-4 z-50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.6)] transition-all duration-300",
          open
            ? "bg-white text-black scale-95"
            : "bg-[#111] border border-white/10 text-white hover:border-white/20 hover:bg-[#1a1a1a]"
        )}
      >
        {open ? (
          <X className="w-5 h-5" />
        ) : (
          <div className="relative">
            <Bot className="w-5 h-5" />
            {(urgentCount > 0 || warnCount > 0) && (
              <span
                className={cn(
                  "absolute -top-2 -right-2 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center",
                  urgentCount > 0 ? "bg-red-500 animate-pulse" : "bg-amber-500"
                )}
              >
                {totalAlerts}
              </span>
            )}
          </div>
        )}
      </button>
    </>
  );
}
