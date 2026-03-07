"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { claimExchangePost, closeExchangePost } from "@/lib/actions/exchange";
import { EXCHANGE_CATEGORIES } from "@/types";
import type { ExchangePost } from "@/types";
import { X, Zap, MapPin, Clock } from "lucide-react";

interface ExchangePostCardProps {
  post: ExchangePost;
  currentUserId?: string;
  eventSlug: string;
  isMatch?: boolean; // highlighted as a suggested match
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function ExchangePostCard({ post, currentUserId, eventSlug, isMatch }: ExchangePostCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [actionDone, setActionDone] = useState(false);

  const isOwn = post.user_id === currentUserId;
  const cat = EXCHANGE_CATEGORIES.find((c) => c.id === post.category);
  const isNeed = post.type === "need";

  const handleClaim = async () => {
    setLoading(true);
    const result = await claimExchangePost(post.id, post.event_id, eventSlug);
    if (!result?.error) {
      setActionDone(true);
      router.refresh();
    }
    setLoading(false);
  };

  const handleClose = async () => {
    setLoading(true);
    await closeExchangePost(post.id, post.event_id, eventSlug);
    router.refresh();
    setLoading(false);
  };

  return (
    <div
      className={cn(
        "glass rounded-[28px] p-6 space-y-4 transition-all duration-300 border",
        isMatch
          ? "border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)] animate-slide-up"
          : "border-white/5",
        post.status === "matched" && "opacity-70",
        post.status === "closed" && "opacity-40"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type badge */}
          <span
            className={cn(
              "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.15em]",
              isNeed
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-teal-500/10 text-teal-400 border border-teal-500/20"
            )}
          >
            {isNeed ? "Need" : "Offer"}
          </span>

          {/* Category */}
          {cat && (
            <span className="px-3 py-1 rounded-full text-[9px] font-medium uppercase tracking-[0.1em] bg-white/5 border border-white/5 text-gray-400">
              {cat.emoji} {cat.label}
            </span>
          )}

          {/* Match badge */}
          {isMatch && (
            <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] bg-white/10 text-white border border-white/20 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Match
            </span>
          )}
        </div>

        {/* Status / close */}
        <div className="flex items-center gap-2 shrink-0">
          {post.status === "matched" && (
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-green-400">
              Matched
            </span>
          )}
          {post.status === "closed" && (
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-600">
              Closed
            </span>
          )}
          {isOwn && post.status === "open" && (
            <button
              onClick={handleClose}
              disabled={loading}
              className="w-6 h-6 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <p className="text-xl font-light text-white leading-snug">{post.title}</p>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium">
          <span>{post.user?.name ?? "Anonymous"}</span>
          {post.table_number && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Table {post.table_number}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(post.created_at)}
          </span>
        </div>

        {/* Connect button — only for open posts that aren't own */}
        {!isOwn && post.status === "open" && currentUserId && (
          <button
            onClick={handleClaim}
            disabled={loading || actionDone}
            className={cn(
              "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all",
              actionDone
                ? "bg-green-500/20 text-green-400 border border-green-500/20"
                : isNeed
                ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                : "bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20"
            )}
          >
            {loading ? "..." : actionDone ? "Connected!" : isNeed ? "I Can Help" : "I Need This"}
          </button>
        )}

        {/* Matched: show who matched */}
        {post.status === "matched" && post.matched_user && (
          <span className="text-[10px] text-green-400 font-medium">
            Connected with {post.matched_user.name}
            {post.matched_user && " — find them at their table!"}
          </span>
        )}
      </div>
    </div>
  );
}
