"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { attendeeChat } from "@/lib/actions/attendee-chat";
import type { ChatMessage } from "@/lib/actions/attendee-chat";

interface AttendeeChatWidgetProps {
  eventSlug: string;
  eventName: string;
}

const SUGGESTED_QUESTIONS = [
  "What's on the schedule tonight?",
  "How do I book a demo slot?",
  "What's the discussion theme?",
  "How does speed networking work?",
];

export function AttendeeChatWidget({ eventSlug, eventName }: AttendeeChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setLoading(true);

    const { reply, error } = await attendeeChat(eventSlug, newMessages);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: error || reply },
    ]);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Chat popup */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[340px] max-h-[520px] flex flex-col rounded-[28px] bg-[#0a0a0a] border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/90">Event Assistant</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                  {eventName}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-3 h-3 text-white/40" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ minHeight: "200px", maxHeight: "360px" }}
          >
            {isEmpty ? (
              <div className="space-y-4">
                <div className="text-center pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-700 font-medium mb-1">
                    Hi there!
                  </p>
                  <p className="text-xs text-gray-600">
                    Ask me anything about tonight's event.
                  </p>
                </div>
                <div className="space-y-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="w-full text-left px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[86%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.role === "user"
                        ? "ml-auto bg-white text-black rounded-br-sm"
                        : "bg-white/[0.06] text-white/80 rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] rounded-2xl rounded-bl-sm max-w-[55%]">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about tonight..."
              disabled={loading}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-white/20 transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5 text-black" />
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-4 right-4 z-50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.6)] transition-all duration-300",
          open
            ? "bg-white text-black scale-95"
            : "bg-[#111] border border-white/10 text-white hover:border-white/20 hover:bg-[#1a1a1a]"
        )}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>
    </>
  );
}
