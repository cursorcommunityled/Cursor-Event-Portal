"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CursorCredit } from "@/types";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// Participants receive a flat $20 Cursor credit by default.
async function getParticipantCreditAmount(
  _supabase: ServiceClient,
  _eventId: string
) {
  return 20;
}

async function assignParticipantCredit(
  supabase: ServiceClient,
  eventId: string,
  userId: string,
  registrationId: string,
  creditAmount: number
): Promise<{ assigned: boolean; noCodesLeft: boolean; error?: string }> {
  const { data: existing, error: existingError } = await supabase
    .from("cursor_credits")
    .select("id")
    .eq("event_id", eventId)
    .eq("assigned_to", userId)
    .eq("amount_usd", creditAmount)
    .limit(1);

  if (existingError) {
    return { assigned: false, noCodesLeft: false, error: existingError.message };
  }

  if ((existing ?? []).length > 0) {
    return { assigned: false, noCodesLeft: false };
  }

  const { data: available, error: availErr } = await supabase
    .from("cursor_credits")
    .select("id")
    .eq("event_id", eventId)
    .eq("amount_usd", creditAmount)
    .is("assigned_to", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (availErr) {
    return { assigned: false, noCodesLeft: false, error: availErr.message };
  }

  if (!available) {
    return { assigned: false, noCodesLeft: true };
  }

  const { data: updated, error: updErr } = await supabase
    .from("cursor_credits")
    .update({
      assigned_to: userId,
      registration_id: registrationId,
      assigned_at: new Date().toISOString(),
    })
    .eq("id", available.id)
    .is("assigned_to", null)
    .select("id")
    .maybeSingle();

  if (updErr) {
    return { assigned: false, noCodesLeft: false, error: updErr.message };
  }

  return { assigned: !!updated, noCodesLeft: false };
}

export async function fetchCursorCredits(eventId: string): Promise<CursorCredit[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("cursor_credits")
    .select("*, user:users(name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  return (data ?? []) as CursorCredit[];
}

export async function fetchMyCredits(
  eventId: string,
  userId: string
): Promise<CursorCredit[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("cursor_credits")
    .select("*")
    .eq("event_id", eventId)
    .eq("assigned_to", userId)
    .order("amount_usd", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []) as CursorCredit[];
}

export async function assignCursorCreditForAttendee(
  eventId: string,
  userId: string,
  registrationId: string
): Promise<{ assigned: boolean; noCodesLeft: boolean; error?: string }> {
  const supabase = await createServiceClient();
  const creditAmount = await getParticipantCreditAmount(supabase, eventId);

  return assignParticipantCredit(
    supabase,
    eventId,
    userId,
    registrationId,
    creditAmount
  );
}

// ─── Import Codes ─────────────────────────────────────────────────────────────

export async function importCreditCodes(
  eventId: string,
  rawCodes: string[],
  adminCode: string
): Promise<{ inserted: number; duplicates: number; error?: string }> {
  const supabase = await createServiceClient();
  const creditAmount = await getParticipantCreditAmount(supabase, eventId);

  // Normalise: strip the referral URL prefix if present, keep only alphanumeric
  const PREFIX = "https://cursor.com/referral?code=";
  const codes = rawCodes
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => (raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw))
    .map((raw) => raw.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (codes.length === 0) return { inserted: 0, duplicates: 0, error: "No valid codes found" };

  const seenCodes = new Set<string>();
  const uniqueCodes: string[] = [];
  let duplicates = 0;

  for (const code of codes) {
    if (seenCodes.has(code)) {
      duplicates++;
    } else {
      seenCodes.add(code);
      uniqueCodes.push(code);
    }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("cursor_credits")
    .select("credit_code")
    .eq("event_id", eventId)
    .in("credit_code", uniqueCodes);

  if (existingError) {
    return { inserted: 0, duplicates: 0, error: existingError.message };
  }

  const existingCodes = new Set((existingRows ?? []).map((row) => row.credit_code));
  const rows = uniqueCodes
    .filter((code) => {
      if (existingCodes.has(code)) {
        duplicates++;
        return false;
      }
      return true;
    })
    .map((code) => ({ event_id: eventId, credit_code: code, amount_usd: creditAmount }));

  if (rows.length === 0) {
    return { inserted: 0, duplicates };
  }

  const { data, error } = await supabase
    .from("cursor_credits")
    .insert(rows)
    .select("id");

  if (error) {
    // If it's a unique constraint violation, try inserting one-by-one to count duplicates
    if (error.code === "23505") {
      let inserted = 0;
      for (const row of rows) {
        const { error: rowErr } = await supabase
          .from("cursor_credits")
          .insert(row);
        if (rowErr) {
          if (rowErr.code === "23505") {
            duplicates++;
          } else {
            return { inserted, duplicates, error: rowErr.message };
          }
        } else {
          inserted++;
        }
      }
      revalidatePath(`/admin/${adminCode}/event-dashboard`);
      return { inserted, duplicates };
    }
    return { inserted: 0, duplicates: 0, error: error.message };
  }

  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return { inserted: data?.length ?? 0, duplicates };
}

// ─── Auto-Assign ──────────────────────────────────────────────────────────────

export async function autoAssignCredits(
  eventId: string,
  adminCode: string
): Promise<{ assigned: number; noCodesLeft: boolean; error?: string }> {
  const supabase = await createServiceClient();
  const creditAmount = await getParticipantCreditAmount(supabase, eventId);

  // Get checked-in registrations (max 1 participant credit per user per event)
  const { data: regs, error: regsError } = await supabase
    .from("registrations")
    .select("id, user_id")
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null);

  if (regsError) return { assigned: 0, noCodesLeft: false, error: regsError.message };

  if (!regs || regs.length === 0) return { assigned: 0, noCodesLeft: false };

  // Users who already have the participant credit for this event (limit: 1 per user)
  const { data: existing } = await supabase
    .from("cursor_credits")
    .select("assigned_to")
    .eq("event_id", eventId)
    .eq("amount_usd", creditAmount)
    .not("assigned_to", "is", null);

  const assignedUserIds = new Set((existing ?? []).map((c: any) => c.assigned_to));
  const unassignedRegs = regs.filter((r: any) => !assignedUserIds.has(r.user_id));

  if (unassignedRegs.length === 0) return { assigned: 0, noCodesLeft: false };

  let assigned = 0;
  let noCodesLeft = false;

  for (const reg of unassignedRegs) {
    const result = await assignParticipantCredit(
      supabase,
      eventId,
      reg.user_id,
      reg.id,
      creditAmount
    );
    if (result.error) {
      return { assigned, noCodesLeft: false, error: result.error };
    }
    if (result.noCodesLeft) {
      noCodesLeft = true;
      break;
    }
    if (result.assigned) assigned++;
  }

  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return {
    assigned,
    noCodesLeft,
  };
}

// ─── Unassign ─────────────────────────────────────────────────────────────────

export async function unassignCredit(
  creditId: string,
  adminCode: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("cursor_credits")
    .update({ assigned_to: null, registration_id: null, assigned_at: null })
    .eq("id", creditId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return { success: true };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCreditCode(
  creditId: string,
  adminCode: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createServiceClient();
  // Only delete if unassigned
  const { error } = await supabase
    .from("cursor_credits")
    .delete()
    .eq("id", creditId)
    .is("assigned_to", null);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return { success: true };
}

// ─── Mark Redeemed (attendee) ─────────────────────────────────────────────────

export async function markCreditRedeemed(
  creditId: string,
  userId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createServiceClient();
  // Validate ownership before updating
  const { data: credit } = await supabase
    .from("cursor_credits")
    .select("assigned_to")
    .eq("id", creditId)
    .single();
  if (!credit || credit.assigned_to !== userId) {
    return { error: "Unauthorised" };
  }
  const { error } = await supabase
    .from("cursor_credits")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("id", creditId);
  if (error) return { error: error.message };
  return { success: true };
}
