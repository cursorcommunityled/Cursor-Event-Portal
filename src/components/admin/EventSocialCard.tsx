"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSeenItemIds } from "@/lib/supabase/seenItems";
import type { Event, Question } from "@/types";

interface EventSocialCardProps {
  event: Event;
  eventSlug: string;
  adminCode: string;
  initialOpenQuestions: number;
  initialQuestions: Question[];
  userId?: string; // Optional: if provided, uses Supabase for seen tracking
}

export function EventSocialCard({
  event,
  eventSlug,
  adminCode,
  initialOpenQuestions,
  initialQuestions,
  userId,
}: EventSocialCardProps) {
  const router = useRouter();
  const [openQuestions, setOpenQuestions] = useState(initialOpenQuestions);
  const [questions, setQuestions] = useState(initialQuestions);
  const [newQuestionAlert, setNewQuestionAlert] = useState(false);
  const [seenQuestionIds, setSeenQuestionIds] = useState<Set<string>>(new Set());

  // Load seen question IDs from Supabase
  const loadSeenQuestionIds = useCallback(async () => {
    if (!userId) return;
    
    try {
      const seenIds = await getSeenItemIds(userId, event.id, 'question');
      setSeenQuestionIds(new Set(seenIds));
    } catch (error) {
      console.error("[EventSocialCard] Error loading seen questions:", error);
    }
  }, [userId, event.id]);

  // Load seen IDs on mount
  useEffect(() => {
    if (userId) {
      loadSeenQuestionIds();
    }
  }, [userId, loadSeenQuestionIds]);

  // Check for new questions and subscribe to changes
  useEffect(() => {
    const checkNewQuestions = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("questions")
        .select("id, status, created_at")
        .eq("event_id", event.id)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (!data) {
        setOpenQuestions(0);
        setNewQuestionAlert(false);
        return;
      }

      const openQ = data.length;
      setOpenQuestions(openQ);

      // Only show alert if there are open questions that haven't been seen
      const unseenQuestions = data.filter((q) => !seenQuestionIds.has(q.id));
      setNewQuestionAlert(unseenQuestions.length > 0);

      // Update questions state - filter to open questions only
      const openQData = data.filter((q) => q.status === "open");
      setQuestions(openQData as Question[]);
    };

    checkNewQuestions().catch(err => console.error("Error checking questions:", err));

    // Subscribe to question changes
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-dashboard-questions-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
          filter: `event_id=eq.${event.id}`,
        },
        () => {
          checkNewQuestions().catch(err => console.error("Error checking questions on update:", err));
        }
      );
    
    // Subscribe - just call it directly, no need to handle return value
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[EventSocialCard] Subscribed to questions");
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, seenQuestionIds]);

  const SOCIAL_TABS = [
    { id: "copilot", label: "Copilot" },
    { id: "qa", label: "Q&A" },
    { id: "connect", label: "Connect" },
    { id: "polls", label: "Polls" },
    { id: "announcements", label: "Broadcast" },
    { id: "follow-up", label: "Follow-Up" },
  ];

  return (
    <div
      className="animate-slide-up cursor-pointer"
      style={{ animationDelay: "700ms" }}
      onClick={() => router.push(`/admin/${adminCode}/social`)}
    >
      <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group relative overflow-hidden shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
              <MessageCircle className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-light tracking-tight text-white/90">Engagement</h3>
              <div className="flex flex-wrap items-center gap-x-1">
                {SOCIAL_TABS.map((tab, i, arr) => (
                  <span key={tab.id} className="flex items-center gap-1">
                    <Link
                      href={`/admin/${adminCode}/social?tab=${tab.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium hover:text-white transition-colors"
                    >
                      {tab.label}
                    </Link>
                    {i < arr.length - 1 && <span className="text-[10px] text-gray-700 select-none">·</span>}
                  </span>
                ))}
                {newQuestionAlert && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-green-400 font-bold flex items-center ml-1">
                    <span className="mr-1">•</span> New
                  </span>
                )}
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
}
