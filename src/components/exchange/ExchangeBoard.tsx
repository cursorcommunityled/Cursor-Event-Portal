"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ExchangePostCard } from "./ExchangePostCard";
import { ExchangePostForm } from "./ExchangePostForm";
import type { ExchangePost } from "@/types";
import { Zap } from "lucide-react";

type FilterTab = "all" | "needs" | "offers" | "mine";

interface ExchangeBoardProps {
  event: { id: string; slug: string };
  initialPosts: ExchangePost[];
  currentUserId?: string;
  userTableNumber?: number | null;
}

/**
 * Score a candidate post as a "match" for the current user's open posts.
 * Higher = better match.
 */
function matchScore(
  myPost: ExchangePost,
  candidate: ExchangePost,
  userTableNumber?: number | null
): number {
  if (candidate.user_id === myPost.user_id) return -1;
  // Must be complementary type
  if (candidate.type === myPost.type) return -1;
  let score = 0;
  if (candidate.category === myPost.category) score += 10;
  if (userTableNumber && candidate.table_number === userTableNumber) score += 5;
  return score;
}

export function ExchangeBoard({ event, initialPosts, currentUserId, userTableNumber }: ExchangeBoardProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<ExchangePost[]>(initialPosts);
  const [filter, setFilter] = useState<FilterTab>("all");

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`exchange-posts-${event.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "exchange_posts", filter: `event_id=eq.${event.id}` },
        async (payload) => {
          const { data } = await supabase
            .from("exchange_posts")
            .select("*, user:users!exchange_posts_user_id_fkey(id, name), matched_user:users!exchange_posts_matched_with_fkey(id, name)")
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setPosts((prev) => prev.some((p) => p.id === data.id) ? prev : [data, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "exchange_posts", filter: `event_id=eq.${event.id}` },
        async (payload) => {
          const { data } = await supabase
            .from("exchange_posts")
            .select("*, user:users!exchange_posts_user_id_fkey(id, name), matched_user:users!exchange_posts_matched_with_fkey(id, name)")
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setPosts((prev) => prev.map((p) => p.id === data.id ? data : p));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "exchange_posts", filter: `event_id=eq.${event.id}` },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [event.id]);

  // My open posts → derive suggested matches
  const myOpenPosts = currentUserId
    ? posts.filter((p) => p.user_id === currentUserId && p.status === "open")
    : [];

  const suggestedMatches = currentUserId
    ? posts.filter((candidate) => {
        if (candidate.status !== "open") return false;
        return myOpenPosts.some((mine) => matchScore(mine, candidate, userTableNumber) >= 10);
      })
    : [];

  const now = new Date();

  // Filtered posts: exclude expired, hide own in "all/needs/offers"
  const activePosts = posts.filter((p) => {
    if (p.status === "closed") return false;
    if (new Date(p.expires_at) < now && p.status === "open") return false;
    return true;
  });

  const filteredPosts = activePosts.filter((p) => {
    if (filter === "mine") return p.user_id === currentUserId;
    if (filter === "needs") return p.type === "need";
    if (filter === "offers") return p.type === "offer";
    return true;
  });

  const openCount = activePosts.filter((p) => p.status === "open").length;
  const needsCount = activePosts.filter((p) => p.type === "need" && p.status === "open").length;
  const offersCount = activePosts.filter((p) => p.type === "offer" && p.status === "open").length;

  const FILTER_TABS: Array<{ id: FilterTab; label: string; count?: number }> = [
    { id: "all",    label: "All",    count: openCount },
    { id: "needs",  label: "Needs",  count: needsCount },
    { id: "offers", label: "Offers", count: offersCount },
    { id: "mine",   label: "Mine" },
  ];

  return (
    <div className="space-y-8">
      {/* Post form */}
      {currentUserId && (
        <ExchangePostForm eventId={event.id} eventSlug={event.slug} />
      )}

      {/* Suggested matches */}
      {suggestedMatches.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 px-1">
            <Zap className="w-3.5 h-3.5 text-white/60" />
            <p className="text-[9px] uppercase tracking-[0.3em] text-gray-400 font-bold">
              Suggested Matches for You
            </p>
          </div>
          <div className="space-y-3">
            {suggestedMatches.slice(0, 3).map((post) => (
              <ExchangePostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                eventSlug={event.slug}
                isMatch
              />
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all",
              filter === tab.id
                ? "bg-white text-black shadow-glow"
                : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "text-[8px]",
                filter === tab.id ? "text-black/50" : "text-gray-700"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-20 glass rounded-[40px] border-dashed border-white/5 opacity-40">
          <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
            {filter === "mine" ? "You haven't posted anything yet" : "Nothing here yet — be first!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post, i) => (
            <div
              key={post.id}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <ExchangePostCard
                post={post}
                currentUserId={currentUserId}
                eventSlug={event.slug}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
