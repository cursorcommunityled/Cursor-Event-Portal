"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createExchangePost } from "@/lib/actions/exchange";
import { EXCHANGE_CATEGORIES } from "@/types";
import type { ExchangeCategory, ExchangePostType } from "@/types";
import { Plus, X } from "lucide-react";

interface ExchangePostFormProps {
  eventId: string;
  eventSlug: string;
}

export function ExchangePostForm({ eventId, eventSlug }: ExchangePostFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ExchangePostType>("need");
  const [category, setCategory] = useState<ExchangeCategory | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!category) {
      setError("Please choose a category");
      return;
    }
    if (!title.trim()) {
      setError("Please describe your need or offer");
      return;
    }

    setLoading(true);
    const result = await createExchangePost(eventId, eventSlug, { type, category, title: title.trim() });

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTitle("");
      setCategory(null);
      setType("need");
      router.refresh();
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 1500);
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full h-16 rounded-full glass border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] group"
      >
        <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
          <Plus className="w-3.5 h-3.5" />
        </div>
        Post a Need or Offer
      </button>
    );
  }

  return (
    <div className="glass rounded-[32px] p-8 space-y-8 animate-slide-up border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em]">
          New Post
        </p>
        <button
          onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-600 hover:text-white transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Type toggle */}
        <div className="space-y-3">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-medium px-1">
            I have a…
          </p>
          <div className="flex gap-3">
            {(["need", "offer"] as ExchangePostType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex-1 h-12 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all border",
                  type === t
                    ? t === "need"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                      : "bg-teal-500/10 border-teal-500/30 text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.1)]"
                    : "bg-white/[0.01] border-white/5 text-gray-600 hover:text-white hover:border-white/20"
                )}
              >
                {t === "need" ? "Need" : "Offer"}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-3">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-medium px-1">
            Category
          </p>
          <div className="flex flex-wrap gap-2">
            {EXCHANGE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] transition-all border",
                  category === cat.id
                    ? "bg-white border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    : "bg-white/[0.01] border-white/5 text-gray-600 hover:text-white hover:border-white/20"
                )}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-medium px-1">
            Description <span className="text-gray-700">({title.length}/100)</span>
          </p>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 100))}
            placeholder={
              type === "need"
                ? "e.g. Need help debugging my Cursor agent integration..."
                : "e.g. Can review pitch decks — 5 years in venture..."
            }
            rows={2}
            disabled={loading}
            className="w-full bg-transparent border-b border-white/10 rounded-none py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-all text-lg font-light resize-none"
          />
        </div>

        {error && (
          <p className="text-center p-3 rounded-2xl bg-red-500/5 text-red-400/80 text-[10px] font-medium uppercase tracking-widest animate-fade-in">
            {error}
          </p>
        )}

        {success && (
          <p className="text-center p-3 rounded-2xl bg-green-500/5 text-green-400/80 text-[10px] font-medium uppercase tracking-widest animate-fade-in">
            Posted!
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !title.trim() || !category}
          className="w-full h-14 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-[0.98]"
        >
          {loading ? "..." : `Post ${type === "need" ? "Need" : "Offer"}`}
        </button>
      </form>
    </div>
  );
}
