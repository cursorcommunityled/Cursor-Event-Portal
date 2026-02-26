"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CompetitionCard } from "./CompetitionCard";
import type { CompetitionWithEntries } from "@/types";

interface CompetitionsListProps {
  initialCompetitions: CompetitionWithEntries[];
  eventId: string;
  eventSlug: string;
  userId: string;
  isAdmin?: boolean;
}

export function CompetitionsList({
  initialCompetitions,
  eventId,
  eventSlug,
  userId,
  isAdmin = false,
}: CompetitionsListProps) {
  const [competitions, setCompetitions] = useState(initialCompetitions);

  // Log on mount
  useEffect(() => {
    console.log("[CompetitionsList] Mounted with", initialCompetitions.length, "competitions for event:", eventId);
  }, []);

  // Load competitions with vote counts, and subscribe to realtime
  useEffect(() => {
    const supabase = createClient();

    const fetchCompetitions = async () => {
      const { data } = await supabase
        .from("competitions")
        .select("*, entries:competition_entries!competition_entries_competition_id_fkey(*, user:users(id, name, email))")
        .eq("event_id", eventId)
        .in("status", ["active", "voting", "ended"])
        .order("created_at", { ascending: false });

      if (data) {
        // Load votes for each competition's entries
        for (const comp of data) {
          if (comp.entries) {
            const { data: votes } = await supabase
              .from("competition_votes")
              .select("*")
              .eq("competition_id", comp.id);

            const allVotes = votes || [];
            for (const entry of comp.entries) {
              const entryVotes = allVotes.filter((v: { entry_id: string }) => v.entry_id === entry.id);
              entry.vote_count = entryVotes.length;
              entry.avg_score =
                entryVotes.length > 0
                  ? entryVotes.reduce((sum: number, v: { score: number }) => sum + v.score, 0) / entryVotes.length
                  : 0;
            }

            if (comp.winner_entry_id) {
              comp.winner_entry = comp.entries.find((e: { id: string }) => e.id === comp.winner_entry_id) || null;
            }
          }
        }
        setCompetitions(data);
      }
    };

    // Load vote counts on mount and after refresh (server data has no vote_count)
    fetchCompetitions();

    const channel = supabase
      .channel(`competitions-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competitions", filter: `event_id=eq.${eventId}` },
        () => fetchCompetitions()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_entries" },
        () => fetchCompetitions()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_votes" },
        () => fetchCompetitions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (competitions.length === 0) {
    return (
      <div className="glass rounded-[40px] p-12 border-white/10 text-center">
        <p className="text-gray-500 text-sm">No active competitions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {competitions.map((competition) => (
        <CompetitionCard
          key={competition.id}
          competition={competition}
          eventSlug={eventSlug}
          userId={userId}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
