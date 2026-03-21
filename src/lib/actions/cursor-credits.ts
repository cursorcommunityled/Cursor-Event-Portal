"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CursorCredit } from "@/types";

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

// ─── Import Codes ─────────────────────────────────────────────────────────────

export async function importCreditCodes(
  eventId: string,
  rawCodes: string[],
  adminCode: string
): Promise<{ inserted: number; duplicates: number; error?: string }> {
  const supabase = await createServiceClient();

  // Normalise: strip the referral URL prefix if present, keep only alphanumeric
  const PREFIX = "https://cursor.com/referral?code=";
  const codes = rawCodes
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => (raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw))
    .map((raw) => raw.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (codes.length === 0) return { inserted: 0, duplicates: 0, error: "No valid codes found" };

  const rows = codes.map((code) => ({ event_id: eventId, credit_code: code }));

  const { data, error } = await supabase
    .from("cursor_credits")
    .insert(rows)
    .select("id");

  if (error) {
    // If it's a unique constraint violation, try inserting one-by-one to count duplicates
    if (error.code === "23505") {
      let inserted = 0;
      let duplicates = 0;
      for (const row of rows) {
        const { error: rowErr } = await supabase
          .from("cursor_credits")
          .insert(row);
        if (rowErr) {
          duplicates++;
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
  return { inserted: data?.length ?? 0, duplicates: 0 };
}

// ─── Auto-Assign ──────────────────────────────────────────────────────────────

export async function autoAssignCredits(
  eventId: string,
  adminCode: string
): Promise<{ assigned: number; noCodesLeft: boolean; error?: string }> {
  const supabase = await createServiceClient();

  // Get checked-in registrations without a credit
  const { data: regs, error: regsError } = await supabase
    .from("registrations")
    .select("id, user_id")
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null);

  if (regsError) return { assigned: 0, noCodesLeft: false, error: regsError.message };

  if (!regs || regs.length === 0) return { assigned: 0, noCodesLeft: false };

  // Get existing assigned user_ids for this event
  const { data: existing } = await supabase
    .from("cursor_credits")
    .select("assigned_to")
    .eq("event_id", eventId)
    .not("assigned_to", "is", null);

  const assignedUserIds = new Set((existing ?? []).map((c: any) => c.assigned_to));
  const unassignedRegs = regs.filter((r: any) => !assignedUserIds.has(r.user_id));

  if (unassignedRegs.length === 0) return { assigned: 0, noCodesLeft: false };

  // Get available (unassigned) codes for this event
  const { data: available, error: availErr } = await supabase
    .from("cursor_credits")
    .select("id")
    .eq("event_id", eventId)
    .is("assigned_to", null)
    .order("created_at", { ascending: true })
    .limit(unassignedRegs.length);

  if (availErr) return { assigned: 0, noCodesLeft: false, error: availErr.message };
  if (!available || available.length === 0) return { assigned: 0, noCodesLeft: true };

  const now = new Date().toISOString();
  let assigned = 0;

  for (let i = 0; i < Math.min(unassignedRegs.length, available.length); i++) {
    const reg = unassignedRegs[i];
    const credit = available[i];
    const { error: updErr } = await supabase
      .from("cursor_credits")
      .update({
        assigned_to: reg.user_id,
        registration_id: reg.id,
        assigned_at: now,
      })
      .eq("id", credit.id)
      .is("assigned_to", null); // guard against races
    if (!updErr) assigned++;
  }

  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return {
    assigned,
    noCodesLeft: available.length < unassignedRegs.length,
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
