import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { assignCursorCreditForAttendee } from "@/lib/actions/cursor-credits";
import { formatGuestDisplayName, preferCompleteName } from "@/lib/guest-name";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

const LUMA_API_BASE = "https://public-api.luma.com/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LumaGuest {
  api_id?: string;
  user_email?: string | null;
  email?: string | null;
  user_name?: string | null;
  name?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
  approval_status?: string | null;
  checked_in_at?: string | null;
  registered_at?: string | null;
  event_tickets?: Array<{ checked_in_at?: string | null }> | null;
}

export interface LumaGuestSyncResult {
  status: "created" | "updated" | "unchanged" | "skipped" | "error";
  checkedIn: boolean;
  creditAssigned: boolean;
  noCodesLeft: boolean;
  error?: string;
}

// ─── Guest helpers ────────────────────────────────────────────────────────────

// Webhook payloads and list entries sometimes nest the guest under a `guest`
// key; normalise both shapes to a flat guest object.
export function normalizeLumaGuest(entry: unknown): LumaGuest {
  if (entry && typeof entry === "object" && "guest" in (entry as Record<string, unknown>)) {
    const nested = (entry as Record<string, unknown>).guest;
    if (nested && typeof nested === "object") return nested as LumaGuest;
  }
  return (entry ?? {}) as LumaGuest;
}

export function lumaGuestEmail(guest: LumaGuest): string | null {
  const raw = guest.user_email ?? guest.email;
  const email = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return email.includes("@") ? email : null;
}

export function lumaGuestName(guest: LumaGuest, email: string): string {
  const fromParts = [guest.user_first_name, guest.user_last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  const combined = preferCompleteName(
    preferCompleteName(fromParts, guest.user_name?.trim() ?? ""),
    guest.name?.trim() ?? ""
  );
  return formatGuestDisplayName(combined, email);
}

// A guest counts as checked in if their guest-level checked_in_at is set or
// any of their tickets has been scanned.
export function lumaCheckedInAt(guest: LumaGuest): string | null {
  if (guest.checked_in_at) return guest.checked_in_at;
  const ticketTimes = (guest.event_tickets ?? [])
    .map((t) => t?.checked_in_at)
    .filter((t): t is string => !!t)
    .sort();
  return ticketTimes[0] ?? null;
}

// ─── Luma API ─────────────────────────────────────────────────────────────────

export async function fetchAllLumaGuests(lumaEventId: string): Promise<LumaGuest[]> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not configured");

  const guests: LumaGuest[] = [];
  let cursor: string | undefined;

  // Page cap guards against a runaway loop if the cursor never advances.
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({
      event_id: lumaEventId,
      pagination_limit: "100",
    });
    if (cursor) params.set("pagination_cursor", cursor);

    const res = await fetch(`${LUMA_API_BASE}/events/guests/list?${params}`, {
      headers: { "x-luma-api-key": apiKey, accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`Luma API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const entries: unknown[] = Array.isArray(data.entries) ? data.entries : [];
    for (const entry of entries) guests.push(normalizeLumaGuest(entry));

    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return guests;
}

// ─── Webhook signature verification ──────────────────────────────────────────

// Luma signs webhooks with HMAC-SHA256 over "{timestamp}.{raw_body}" and sends
// the result as a hex digest in the Webhook-Signature header ("t=...,v1=...").
export function verifyLumaWebhookSignature(
  secret: string,
  signatureHeader: string | null,
  rawBody: string
): boolean {
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx > 0) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject stale timestamps to prevent replay attacks.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  return (
    expectedBuf.length === actualBuf.length &&
    timingSafeEqual(expectedBuf, actualBuf)
  );
}

// ─── Sync core ────────────────────────────────────────────────────────────────

// Upserts a single Luma guest into the portal: creates the user and
// registration if needed, stamps checked_in_at from Luma, and assigns the
// participant Cursor credit once checked in. Idempotent — safe to run from
// both the webhook and the bulk sync.
export async function syncLumaGuestToPortal(
  supabase: ServiceClient,
  eventId: string,
  guest: LumaGuest
): Promise<LumaGuestSyncResult> {
  const none: Omit<LumaGuestSyncResult, "status"> = {
    checkedIn: false,
    creditAssigned: false,
    noCodesLeft: false,
  };

  const email = lumaGuestEmail(guest);
  if (!email) return { status: "skipped", ...none };

  const checkedInAt = lumaCheckedInAt(guest);
  const status = guest.approval_status ?? "approved";

  // Only import guests who are actually coming; a check-in always wins even if
  // the status field looks off.
  if (!checkedInAt && !["approved", "checked_in"].includes(status)) {
    return { status: "skipped", ...none };
  }

  const guestName = lumaGuestName(guest, email);

  // Find or create the user.
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, name")
    .eq("email", email)
    .maybeSingle();

  let userId = existingUser?.id as string | undefined;
  let created = false;

  if (userId) {
    const storedName = existingUser?.name ?? "";
    const nextName = formatGuestDisplayName(
      preferCompleteName(storedName, guestName),
      email
    );
    if (nextName && nextName !== storedName) {
      await supabase.from("users").update({ name: nextName }).eq("id", userId);
    }
  }

  if (!userId) {
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        name: guestName,
        email,
        role: "attendee",
      })
      .select("id")
      .single();

    if (userError || !newUser) {
      return { status: "error", ...none, error: userError?.message ?? "Failed to create user" };
    }
    userId = newUser.id;
    created = true;
  }

  // Find or create the registration.
  const { data: existingReg } = await supabase
    .from("registrations")
    .select("id, checked_in_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  let registrationId = existingReg?.id as string | undefined;
  let didCheckIn = false;

  if (!registrationId) {
    const { data: newReg, error: regError } = await supabase
      .from("registrations")
      .insert({
        event_id: eventId,
        user_id: userId,
        source: "link",
        checked_in_at: checkedInAt,
      })
      .select("id")
      .single();

    if (regError || !newReg) {
      return { status: "error", ...none, error: regError?.message ?? "Failed to create registration" };
    }
    registrationId = newReg.id;
    created = true;
    didCheckIn = !!checkedInAt;
  } else if (checkedInAt && !existingReg!.checked_in_at) {
    const { error: checkInError } = await supabase
      .from("registrations")
      .update({ checked_in_at: checkedInAt })
      .eq("id", registrationId);

    if (checkInError) {
      return { status: "error", ...none, error: checkInError.message };
    }
    didCheckIn = true;
  }

  const isCheckedIn = !!checkedInAt || !!existingReg?.checked_in_at;
  let creditAssigned = false;
  let noCodesLeft = false;

  // Checked-in attendees qualify for the participant credit; the assign call
  // is a no-op if they already have one.
  if (isCheckedIn) {
    const credit = await assignCursorCreditForAttendee(eventId, userId!, registrationId!);
    creditAssigned = credit.assigned;
    noCodesLeft = credit.noCodesLeft;
  }

  return {
    status: created ? "created" : didCheckIn || creditAssigned ? "updated" : "unchanged",
    checkedIn: didCheckIn,
    creditAssigned,
    noCodesLeft,
  };
}
