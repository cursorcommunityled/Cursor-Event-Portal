"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";

function getAdminCompetitionsPath(eventSlug: string, adminCode?: string) {
  return adminCode
    ? `/admin/${eventSlug}/${adminCode}/competitions`
    : `/admin/${eventSlug}/competitions`;
}

async function validateAdminAccess(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  adminCode?: string
) {
  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .single();

    if (event && event.admin_code === adminCode) {
      return { valid: true as const };
    }
    return { valid: false as const, error: "Not authorized. Admin access required." };
  }

  const session = await getSession();
  if (!session) {
    return { valid: false as const, error: "Not authenticated" };
  }

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || !["staff", "admin"].includes(user.role)) {
    return { valid: false as const, error: "Not authorized. Admin access required." };
  }

  return { valid: true as const, userId: session.userId };
}

export async function createCompetition(
  eventId: string,
  eventSlug: string,
  data: {
    title: string;
    description?: string;
    rules?: string;
    voting_mode: string;
    starts_at?: string;
    ends_at?: string;
    max_entries?: number;
  },
  adminCode?: string
): Promise<{ success?: true; competitionId?: string; error?: string }> {
  console.log("[createCompetition] Called with:", { eventId, eventSlug, adminCode: !!adminCode, data });
  
  try {
    if (!eventId || !eventSlug || !data?.title?.trim()) {
      console.log("[createCompetition] Validation failed - missing eventId, eventSlug, or title");
      return { error: "Event and title are required." };
    }

    console.log("[createCompetition] Creating service client...");
    const supabase = await createServiceClient();
    console.log("[createCompetition] Validating admin access...");
    const auth = await validateAdminAccess(supabase, eventId, adminCode);
    console.log("[createCompetition] Auth result:", auth);
    if (!auth.valid) return { error: auth.error ?? "Not authorized." };

    const insertPayload = {
      event_id: eventId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      rules: data.rules?.trim() || null,
      voting_mode: data.voting_mode,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      max_entries: data.max_entries != null && Number.isFinite(data.max_entries) ? data.max_entries : null,
      status: "draft",
    };
    console.log("[createCompetition] Inserting:", insertPayload);

    const { data: competition, error } = await supabase
      .from("competitions")
      .insert(insertPayload)
      .select("id")
      .single();

    console.log("[createCompetition] Insert result:", { competition, error });

    if (error) {
      console.error("[createCompetition] Supabase error:", error.code, error.message);
      return { error: error.message };
    }

    if (!competition?.id) {
      console.log("[createCompetition] No competition ID returned");
      return { error: "Competition was created but no ID returned." };
    }

    console.log("[createCompetition] Success! ID:", competition.id);
    revalidatePath(getAdminCompetitionsPath(eventSlug, adminCode));
    revalidatePath(`/${eventSlug}/competitions`);
    return { success: true, competitionId: competition.id };
  } catch (err) {
    console.error("[createCompetition] Exception:", err);
    const message = err instanceof Error ? err.message : "Failed to create competition";
    return { error: message };
  }
}

export async function updateCompetition(
  competitionId: string,
  eventSlug: string,
  data: {
    title?: string;
    description?: string;
    rules?: string;
    voting_mode?: string;
    starts_at?: string | null;
    ends_at?: string | null;
    max_entries?: number | null;
  },
  adminCode?: string
) {
  const supabase = await createServiceClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("event_id")
    .eq("id", competitionId)
    .single();

  if (!competition) return { error: "Competition not found" };

  const auth = await validateAdminAccess(supabase, competition.event_id, adminCode);
  if (!auth.valid) return { error: auth.error };

  const { error } = await supabase
    .from("competitions")
    .update(data)
    .eq("id", competitionId);

  if (error) {
    console.error("[updateCompetition] Error:", error);
    return { error: error.message };
  }

  revalidatePath(getAdminCompetitionsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}

export async function deleteCompetition(
  competitionId: string,
  eventSlug: string,
  adminCode?: string
) {
  const supabase = await createServiceClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("event_id")
    .eq("id", competitionId)
    .single();

  if (!competition) return { error: "Competition not found" };

  const auth = await validateAdminAccess(supabase, competition.event_id, adminCode);
  if (!auth.valid) return { error: auth.error };

  const { error } = await supabase
    .from("competitions")
    .delete()
    .eq("id", competitionId);

  if (error) {
    console.error("[deleteCompetition] Error:", error);
    return { error: error.message };
  }

  revalidatePath(getAdminCompetitionsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}

export async function updateCompetitionStatus(
  competitionId: string,
  eventSlug: string,
  status: string,
  adminCode?: string
): Promise<{ success?: true; error?: string }> {
  console.log("[updateCompetitionStatus] Called:", { competitionId, eventSlug, status, adminCode: !!adminCode });
  
  const supabase = await createServiceClient();

  const { data: competition, error: fetchError } = await supabase
    .from("competitions")
    .select("event_id, status")
    .eq("id", competitionId)
    .single();

  if (fetchError) {
    console.error("[updateCompetitionStatus] Fetch error:", fetchError);
    return { error: fetchError.message };
  }
  if (!competition) return { error: "Competition not found" };

  console.log("[updateCompetitionStatus] Current status:", competition.status, "-> New status:", status);

  const auth = await validateAdminAccess(supabase, competition.event_id, adminCode);
  if (!auth.valid) return { error: auth.error ?? "Not authorized" };

  // Validate transitions: draft -> active -> voting -> ended
  const validTransitions: Record<string, string[]> = {
    draft: ["active"],
    active: ["voting"],
    voting: ["ended"],
    ended: [],
  };

  if (!validTransitions[competition.status]?.includes(status)) {
    const errMsg = `Cannot transition from ${competition.status} to ${status}`;
    console.log("[updateCompetitionStatus]", errMsg);
    return { error: errMsg };
  }

  const { error } = await supabase
    .from("competitions")
    .update({ status })
    .eq("id", competitionId);

  if (error) {
    console.error("[updateCompetitionStatus] Update error:", error);
    return { error: error.message };
  }

  console.log("[updateCompetitionStatus] Success! Status updated to:", status);
  revalidatePath(getAdminCompetitionsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}

export async function selectWinner(
  competitionId: string,
  eventSlug: string,
  method: "auto" | "manual",
  entryId?: string,
  adminCode?: string
) {
  const supabase = await createServiceClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("event_id, status, voting_mode")
    .eq("id", competitionId)
    .single();

  if (!competition) return { error: "Competition not found" };

  const auth = await validateAdminAccess(supabase, competition.event_id, adminCode);
  if (!auth.valid) return { error: auth.error };

  let winnerEntryId = entryId;

  if (method === "auto") {
    // Get entry with highest score
    const { data: votes } = await supabase
      .from("competition_votes")
      .select("entry_id, score, is_judge")
      .eq("competition_id", competitionId);

    if (!votes || votes.length === 0) {
      return { error: "No votes to calculate winner" };
    }

    // Aggregate scores per entry
    const entryScores = new Map<string, number>();
    for (const vote of votes) {
      const weight = vote.is_judge ? 2 : 1;
      const current = entryScores.get(vote.entry_id) || 0;
      entryScores.set(vote.entry_id, current + vote.score * weight);
    }

    let maxScore = 0;
    for (const [eid, score] of Array.from(entryScores)) {
      if (score > maxScore) {
        maxScore = score;
        winnerEntryId = eid;
      }
    }
  }

  if (!winnerEntryId) return { error: "No winner entry specified" };

  const { error } = await supabase
    .from("competitions")
    .update({
      winner_entry_id: winnerEntryId,
      winner_method: method,
    })
    .eq("id", competitionId);

  if (error) {
    console.error("[selectWinner] Error:", error);
    return { error: error.message };
  }

  revalidatePath(getAdminCompetitionsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true, winnerEntryId };
}

export async function submitEntry(
  competitionId: string,
  eventSlug: string,
  data: {
    title: string;
    description?: string;
    repo_url: string;
    project_url?: string;
    preview_image_url?: string;
    video_url?: string;
  }
) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  // Check competition exists and is active
  const { data: competition } = await supabase
    .from("competitions")
    .select("status, max_entries")
    .eq("id", competitionId)
    .single();

  if (!competition) return { error: "Competition not found" };
  if (competition.status !== "active") {
    return { error: "Competition is not accepting submissions" };
  }

  // Check max entries
  if (competition.max_entries) {
    const { count } = await supabase
      .from("competition_entries")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId);

    if ((count || 0) >= competition.max_entries) {
      return { error: "Competition has reached maximum entries" };
    }
  }

  // Check if user already has an entry
  const { data: existing } = await supabase
    .from("competition_entries")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (existing) {
    return { error: "You already have an entry in this competition" };
  }

  const { error } = await supabase.from("competition_entries").insert({
    competition_id: competitionId,
    user_id: session.userId,
    title: data.title,
    description: data.description || null,
    repo_url: data.repo_url,
    project_url: data.project_url || null,
    preview_image_url: data.preview_image_url?.trim() || null,
    video_url: data.video_url?.trim() || null,
  });

  if (error) {
    console.error("[submitEntry] Error:", error);
    return { error: error.message };
  }

  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}

export async function updateEntry(
  entryId: string,
  eventSlug: string,
  data: {
    title?: string;
    description?: string;
    repo_url?: string;
    project_url?: string;
    preview_image_url?: string | null;
    video_url?: string | null;
  }
) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { data: entry } = await supabase
    .from("competition_entries")
    .select("user_id, competition_id")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found" };
  if (entry.user_id !== session.userId) return { error: "Not your entry" };

  // Check competition is still active
  const { data: competition } = await supabase
    .from("competitions")
    .select("status")
    .eq("id", entry.competition_id)
    .single();

  if (!competition || competition.status !== "active") {
    return { error: "Competition is not accepting modifications" };
  }

  const { error } = await supabase
    .from("competition_entries")
    .update(data)
    .eq("id", entryId);

  if (error) {
    console.error("[updateEntry] Error:", error);
    return { error: error.message };
  }

  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}

export async function castVote(
  competitionId: string,
  entryId: string,
  eventSlug: string,
  score: number = 1,
  isJudge: boolean = false
) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  // Check competition is in voting phase
  const { data: competition } = await supabase
    .from("competitions")
    .select("status, voting_mode, top3_entry_ids")
    .eq("id", competitionId)
    .single();

  if (!competition) return { error: "Competition not found" };
  if (competition.status !== "voting") {
    return { error: "Voting is not open" };
  }

  // In top3 mode: require 3 finalists to be confirmed before any vote is allowed
  if (competition.voting_mode === "top3") {
    const top3 = competition.top3_entry_ids as string[] | null;
    if (!top3 || top3.length < 3) {
      return { error: "Voting will open once the 3 finalists are announced" };
    }
    if (!top3.includes(entryId)) {
      return { error: "You can only vote on the three finalists" };
    }
  }

  // Don't let users vote on their own entry (admins/staff are exempt)
  const { data: entry } = await supabase
    .from("competition_entries")
    .select("user_id")
    .eq("id", entryId)
    .single();

  if (entry?.user_id === session.userId) {
    const { data: userRecord } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (!userRecord || !["staff", "admin"].includes(userRecord.role)) {
      return { error: "Cannot vote on your own entry" };
    }
  }

  // For group/top3 voting, score is always 1; for judges/both use 1-5
  const finalScore = isJudge ? Math.min(Math.max(score, 1), 5) : 1;

  // Upsert vote
  const { error } = await supabase
    .from("competition_votes")
    .upsert(
      {
        competition_id: competitionId,
        entry_id: entryId,
        user_id: session.userId,
        score: finalScore,
        is_judge: isJudge,
      },
      { onConflict: "competition_id,user_id,entry_id" }
    );

  if (error) {
    console.error("[castVote] Error:", error);
    return { error: error.message };
  }

  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}

// --- top3 mode actions ---

export async function selectTop3Entries(
  competitionId: string,
  eventSlug: string,
  entryIds: string[],
  adminCode?: string
): Promise<{ success?: true; error?: string }> {
  if (entryIds.length !== 3) {
    return { error: "You must select exactly 3 finalists" };
  }

  const supabase = await createServiceClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("event_id, status, voting_mode")
    .eq("id", competitionId)
    .single();

  if (!competition) return { error: "Competition not found" };
  if (competition.voting_mode !== "top3") return { error: "Not a top3 competition" };
  if (!["active", "voting"].includes(competition.status)) {
    return { error: "Can only select finalists while active or voting" };
  }

  const auth = await validateAdminAccess(supabase, competition.event_id, adminCode);
  if (!auth.valid) return { error: auth.error ?? "Not authorized" };

  const { error } = await supabase
    .from("competitions")
    .update({ top3_entry_ids: entryIds })
    .eq("id", competitionId);

  if (error) {
    console.error("[selectTop3Entries] Error:", error);
    return { error: error.message };
  }

  revalidatePath(getAdminCompetitionsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}

export async function selectAdminWinner(
  competitionId: string,
  eventSlug: string,
  entryId: string,
  adminCode?: string
): Promise<{ success?: true; error?: string }> {
  const supabase = await createServiceClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("event_id, status, voting_mode, top3_entry_ids")
    .eq("id", competitionId)
    .single();

  if (!competition) return { error: "Competition not found" };
  if (competition.voting_mode !== "top3") return { error: "Not a top3 competition" };
  if (!["voting", "ended"].includes(competition.status)) {
    return { error: "Can only pick admin winner during voting or after competition ends" };
  }

  const top3 = competition.top3_entry_ids as string[] | null;
  if (!top3 || !top3.includes(entryId)) {
    return { error: "Admin winner must be one of the three finalists" };
  }

  const auth = await validateAdminAccess(supabase, competition.event_id, adminCode);
  if (!auth.valid) return { error: auth.error ?? "Not authorized" };

  const { error } = await supabase
    .from("competitions")
    .update({ admin_winner_entry_id: entryId })
    .eq("id", competitionId);

  if (error) {
    console.error("[selectAdminWinner] Error:", error);
    return { error: error.message };
  }

  revalidatePath(getAdminCompetitionsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}

export async function finalizeGroupWinner(
  competitionId: string,
  eventSlug: string,
  adminCode?: string
): Promise<{ success?: true; error?: string; winnerEntryId?: string }> {
  const supabase = await createServiceClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("event_id, status, voting_mode, top3_entry_ids")
    .eq("id", competitionId)
    .single();

  if (!competition) return { error: "Competition not found" };
  if (competition.voting_mode !== "top3") return { error: "Not a top3 competition" };

  const top3 = competition.top3_entry_ids as string[] | null;
  if (!top3 || top3.length !== 3) {
    return { error: "Top 3 finalists have not been selected yet" };
  }

  const auth = await validateAdminAccess(supabase, competition.event_id, adminCode);
  if (!auth.valid) return { error: auth.error ?? "Not authorized" };

  // Count group votes (is_judge=false) only for the top3 entries
  const { data: votes } = await supabase
    .from("competition_votes")
    .select("entry_id, score")
    .eq("competition_id", competitionId)
    .eq("is_judge", false)
    .in("entry_id", top3);

  if (!votes || votes.length === 0) {
    return { error: "No group votes to calculate winner" };
  }

  const voteCounts = new Map<string, number>();
  for (const v of votes) {
    voteCounts.set(v.entry_id, (voteCounts.get(v.entry_id) || 0) + 1);
  }

  let winnerEntryId = "";
  let maxVotes = 0;
  for (const [eid, count] of Array.from(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      winnerEntryId = eid;
    }
  }

  if (!winnerEntryId) return { error: "Could not determine group winner" };

  const { error } = await supabase
    .from("competitions")
    .update({ group_winner_entry_id: winnerEntryId })
    .eq("id", competitionId);

  if (error) {
    console.error("[finalizeGroupWinner] Error:", error);
    return { error: error.message };
  }

  revalidatePath(getAdminCompetitionsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true, winnerEntryId };
}

export async function removeVote(
  competitionId: string,
  entryId: string,
  eventSlug: string
) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("competition_votes")
    .delete()
    .eq("competition_id", competitionId)
    .eq("entry_id", entryId)
    .eq("user_id", session.userId);

  if (error) {
    console.error("[removeVote] Error:", error);
    return { error: error.message };
  }

  revalidatePath(`/${eventSlug}/competitions`);
  return { success: true };
}
