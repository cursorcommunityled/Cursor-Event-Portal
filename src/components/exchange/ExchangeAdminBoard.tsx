"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { adminCloseExchangePost } from "@/lib/actions/exchange";
import { EXCHANGE_CATEGORIES } from "@/types";
import type { ExchangePost } from "@/types";
import { X, MapPin, Clock, Zap } from "lucide-react";

type AdminFilter = "all" | "open" | "matched" | "closed";

interface ExchangeAdminBoardProps {
  eventId: string;
  adminCode: string;
  initialPosts: ExchangePost[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export function ExchangeAdminBoard({ eventId, adminCode, initialPosts }: ExchangeAdminBoardProps) {
  const [posts, setPosts] = useState<ExchangePost[]>(initialPosts);
  const [filter, setFilter] = useState<AdminFilter>("open");
  const [closing, setClosing] = useState<string | null>(null);

  // Real-time
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`exchange-admin-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "exchange_posts", filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const { data } = await supabase
            .from("exchange_posts")
            .select("*, user:users!exchange_posts_user_id_fkey(id, name), matched_user:users!exchange_posts_matched_with_fkey(id, name)")
            .eq("id", payload.new.id)
            .single();
          if (data) setPosts((prev) => prev.some((p) => p.id === data.id) ? prev : [data, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "exchange_posts", filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const { data } = await supabase
            .from("exchange_posts")
            .select("*, user:users!exchange_posts_user_id_fkey(id, name), matched_user:users!exchange_posts_matched_with_fkey(id, name)")
            .eq("id", payload.new.id)
            .single();
          if (data) setPosts((prev) => prev.map((p) => p.id === data.id ? data : p));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const openNeeds   = posts.filter((p) => p.type === "need"  && p.status === "open").length;
  const openOffers  = posts.filter((p) => p.type === "offer" && p.status === "open").length;
  const matched     = posts.filter((p) => p.status === "matched").length;
  const closed      = posts.filter((p) => p.status === "closed").length;

  const filtered = posts.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const handleClose = async (postId: string) => {
    setClosing(postId);
    await adminCloseExchangePost(postId, eventId, adminCode);
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: "closed" as const } : p));
    setClosing(null);
  };

  const FILTERS: Array<{ id: AdminFilter; label: string; count: number }> = [
    { id: "open",    label: "Open",    count: openNeeds + openOffers },
    { id: "matched", label: "Matched", count: matched },
    { id: "closed",  label: "Closed",  count: closed },
    { id: "all",     label: "All",     count: posts.length },
  ];

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Open Needs",   value: openNeeds,  color: "text-amber-400" },
          { label: "Open Offers",  value: openOffers, color: "text-teal-400" },
          { label: "Matched",      value: matched,    color: "text-green-400" },
          { label: "Total",        value: posts.length, color: "text-white" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-[24px] p-5 space-y-1">
            <p className="text-[9px] font-medium text-gray-600 uppercase tracking-[0.3em]">{stat.label}</p>
            <p className={cn("text-3xl font-light", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all",
              filter === f.id
                ? "bg-white text-black shadow-glow"
                : "bg-white/5 text-gray-500 hover:text-white"
            )}
          >
            {f.label}
            <span className={cn("text-[8px]", filter === f.id ? "text-black/50" : "text-gray-700")}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 glass rounded-[40px] border-dashed border-white/5 opacity-40">
          <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
            No posts
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => {
            const cat = EXCHANGE_CATEGORIES.find((c) => c.id === post.category);
            const isNeed = post.type === "need";

            return (
              <div
                key={post.id}
                className={cn(
                  "glass rounded-[24px] p-5 flex items-start gap-4 border",
                  post.status === "matched" ? "border-green-500/10" : "border-white/5",
                  post.status === "closed" && "opacity-40"
                )}
              >
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-[0.15em] border",
                        isNeed
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-teal-500/10 text-teal-400 border-teal-500/20"
                      )}
                    >
                      {isNeed ? "Need" : "Offer"}
                    </span>
                    {cat && (
                      <span className="text-[9px] text-gray-500">
                        {cat.emoji} {cat.label}
                      </span>
                    )}
                    {post.status === "matched" && (
                      <span className="flex items-center gap-1 text-[8px] font-bold text-green-400 uppercase tracking-[0.1em]">
                        <Zap className="w-2.5 h-2.5" /> Matched
                      </span>
                    )}
                  </div>

                  <p className="text-white font-light">{post.title}</p>

                  <div className="flex items-center gap-3 text-[9px] text-gray-600">
                    <span>{post.user?.name ?? "—"}</span>
                    {post.table_number && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> Table {post.table_number}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {timeAgo(post.created_at)}
                    </span>
                    {post.status === "matched" && post.matched_user && (
                      <span className="text-green-400">→ {post.matched_user.name}</span>
                    )}
                  </div>
                </div>

                {post.status !== "closed" && (
                  <button
                    onClick={() => handleClose(post.id)}
                    disabled={closing === post.id}
                    className="shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
