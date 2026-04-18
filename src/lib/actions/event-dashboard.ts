"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Theme Selection ──────────────────────────────────────────────────────────

export async function selectEventTheme(
  eventId: string,
  themeId: string,
  adminCode: string
) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("event_theme_selections")
    .upsert(
      { event_id: eventId, theme_id: themeId, selected_at: new Date().toISOString() },
      { onConflict: "event_id" }
    );
  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return { success: true };
}

export async function clearEventTheme(eventId: string, adminCode: string) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("event_theme_selections")
    .delete()
    .eq("event_id", eventId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${adminCode}/event-dashboard`);
  return { success: true };
}

// ─── Planned Events (Planning Calendar) ──────────────────────────────────────

export async function createPlannedEvent(data: {
  title: string;
  event_date: string;
  end_date?: string | null;
  city: string;
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
  address?: string | null;
  notes?: string | null;
  confirmed?: boolean;
}) {
  const supabase = await createServiceClient();
  const { data: row, error } = await supabase
    .from("planned_events")
    .insert({ ...data })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true, data: row };
}

export async function updatePlannedEvent(
  id: string,
  data: Partial<{
    title: string;
    event_date: string;
    end_date: string | null;
    city: string;
    start_time: string | null;
    end_time: string | null;
    venue: string | null;
    address: string | null;
    notes: string | null;
    confirmed: boolean;
  }>
) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("planned_events")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function deletePlannedEvent(id: string) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("planned_events")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

// ─── Conversation Themes ──────────────────────────────────────────────────────

export async function createConversationTheme(data: {
  name: string;
  description?: string | null;
  emoji?: string | null;
  category?: string | null;
}) {
  const name = data.name.trim();
  if (!name) return { error: "Theme name is required" };

  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from("conversation_themes")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (existing?.sort_order ?? 0) + 1;

  const { data: row, error } = await supabase
    .from("conversation_themes")
    .insert({ ...data, name, sort_order: nextOrder })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true, data: row };
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export async function createVenue(data: { name: string; address?: string | null; city?: string; image_url?: string | null }) {
  const name = data.name.trim();
  if (!name) return { error: "Venue name is required" };

  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from("venues")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (existing?.sort_order ?? 0) + 1;

  const { data: row, error } = await supabase
    .from("venues")
    .insert({ name, address: data.address?.trim() || null, city: data.city || "Calgary", image_url: data.image_url ?? null, sort_order: nextOrder })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Venue already exists" };
    return { error: error.message };
  }
  revalidatePath("/admin");
  return { success: true, data: row };
}

export async function updateVenue(id: string, data: Partial<{ name: string; address: string | null; city: string; image_url: string | null }>) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("venues")
    .update(data)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

// ─── Luma Scraper ─────────────────────────────────────────────────────────────

interface ScrapedLumaEvent {
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  address: string | null;
  notes: string | null;
}

function localDateTime(utcIso: string, timezone: string) {
  const d = new Date(utcIso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // "YYYY-MM-DD"
  const time = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(",", ""); // "HH:MM"
  return { date, time };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNextDataEvent(ev: any): ScrapedLumaEvent {
  const tz: string = ev.timezone ?? "UTC";

  const start = ev.start_at ? localDateTime(ev.start_at, tz) : null;
  const end = ev.end_at ? localDateTime(ev.end_at, tz) : null;

  const geo = ev.geo_address_info ?? {};
  const venueName: string | null =
    ev.location?.name ?? geo.venue ?? geo.place_name ?? null;
  const fullAddress: string | null =
    geo.full_address ?? geo.address ?? null;

  const description: string | null =
    ev.description_md ?? ev.description ?? null;

  return {
    title: ev.name ?? "",
    event_date: start?.date ?? "",
    start_time: start?.time ?? null,
    end_time: end?.time ?? null,
    venue: venueName,
    address: fullAddress,
    notes: description,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonLdEvent(ld: any): ScrapedLumaEvent {
  const startRaw: string = ld.startDate ?? "";
  const endRaw: string = ld.endDate ?? "";

  // JSON-LD dates may already include timezone offset; parse as-is
  const parseDate = (iso: string) => iso.slice(0, 10);
  const parseTime = (iso: string) => {
    const t = iso.slice(11, 16);
    return t.length === 5 ? t : null;
  };

  const loc = ld.location ?? {};
  const venueName: string | null = loc.name ?? null;
  const fullAddress: string | null =
    typeof loc.address === "string"
      ? loc.address
      : loc.address?.streetAddress ?? null;

  return {
    title: ld.name ?? "",
    event_date: startRaw ? parseDate(startRaw) : "",
    start_time: startRaw ? parseTime(startRaw) : null,
    end_time: endRaw ? parseTime(endRaw) : null,
    venue: venueName,
    address: fullAddress,
    notes: ld.description ?? null,
  };
}

export async function scrapeLumaEvent(
  url: string
): Promise<{ error: string } | { data: ScrapedLumaEvent }> {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) normalized = "https://" + normalized;

  // Extract the event slug from the URL (last path segment)
  const slug = normalized.replace(/\/$/, "").split("/").pop() ?? "";

  try {
    // ── Fallback: scrape HTML ────────────────────────────────────────────────
    // (Luma API now requires an API key, so we go straight to HTML scraping)
    const res = await fetch(normalized, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html",
      },
      cache: "no-store",
    });

    if (!res.ok) return { error: `Could not fetch page (HTTP ${res.status})` };

    const html = await res.text();

    // ── Try __NEXT_DATA__ ────────────────────────────────────────────────────
    const nextMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (nextMatch) {
      try {
        const nextData = JSON.parse(nextMatch[1]);
        const pp = nextData?.props?.pageProps ?? {};
        const initialData = pp.initialData ?? {};
        // Luma structure: props.pageProps.initialData = { kind, data: { event, ... } }
        const ev =
          initialData?.data?.event ??
          initialData?.data ??
          pp?.initialData?.event ??
          pp?.event;
        if (ev?.name) return { data: parseNextDataEvent(ev) };
      } catch {
        // fall through
      }
    }

    // ── Try JSON-LD ─────────────────────────────────────────────────────────
    const ldMatches = Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g));
    for (const m of ldMatches) {
      try {
        const ld = JSON.parse(m[1]);
        const target = ld["@type"] === "Event" ? ld : (Array.isArray(ld) ? ld.find((x: { "@type": string }) => x["@type"] === "Event") : null);
        if (target?.name) return { data: parseJsonLdEvent(target) };
      } catch {
        // fall through
      }
    }

    return { error: "Could not find event data on this page. Make sure it's a public Luma event URL." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to scrape URL" };
  }
}

// ─── Calendar Cities ──────────────────────────────────────────────────────────

export async function createEventCalendarCity(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "City name is required" };

  const supabase = await createServiceClient();

  // Get current max sort_order
  const { data: existing } = await supabase
    .from("event_calendar_cities")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (existing?.sort_order ?? 0) + 1;

  const { data: row, error } = await supabase
    .from("event_calendar_cities")
    .insert({ name: trimmed, sort_order: nextOrder })
    .select()
    .single();

  if (error) {
    // Unique constraint = city already exists
    if (error.code === "23505") return { error: "City already exists" };
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true, data: row };
}

// ─── Promote Planned Event → Live Event ───────────────────────────────────────

function toTimestamptz(dateStr: string, timeStr: string, tz: string): string {
  // Convert a local date+time (in tz) to a UTC ISO string.
  // Strategy: treat the inputs as UTC first, compute the tz offset at that moment
  // and shift accordingly. Works correctly across DST boundaries.
  const guessUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  const localStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(guessUtc); // e.g. "2026-04-29 11:30:00"
  const localAsUtcMs = new Date(localStr.replace(" ", "T") + "Z").getTime();
  const offsetMs = guessUtc.getTime() - localAsUtcMs;
  return new Date(guessUtc.getTime() + offsetMs).toISOString();
}

export async function promoteToEvent(
  plannedEventId: string
): Promise<{ error: string } | { data: { id: string; slug: string; admin_code: string } }> {
  const supabase = await createServiceClient();

  const { data: pe, error: peErr } = await supabase
    .from("planned_events")
    .select("*")
    .eq("id", plannedEventId)
    .single();

  if (peErr || !pe) return { error: "Planned event not found" };
  if (pe.linked_event_id) return { error: "Already linked to an event" };

  const slugBase = (pe.title as string)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  let slug = slugBase;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: existing } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${slugBase}-${suffix++}`;
  }

  const admin_code = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");

  const [year, monthNum] = (pe.event_date as string).split("-");
  const MONTH_CODES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const code = `${MONTH_CODES[parseInt(monthNum) - 1]}${year}`;

  const tz = "America/Edmonton";
  const start_time = pe.start_time ? toTimestamptz(pe.event_date, pe.start_time, tz) : null;
  const end_time = pe.end_time ? toTimestamptz(pe.event_date, pe.end_time, tz) : null;

  const { data: newEvent, error: insertErr } = await supabase
    .from("events")
    .insert({
      slug,
      code,
      name: pe.title,
      venue: pe.venue ?? null,
      address: pe.address ?? null,
      start_time,
      end_time,
      status: "draft",
      admin_code,
      timezone: tz,
      capacity: 65,
    })
    .select("id, slug, admin_code")
    .single();

  if (insertErr || !newEvent) return { error: insertErr?.message ?? "Failed to create event" };

  await supabase
    .from("planned_events")
    .update({ linked_event_id: newEvent.id })
    .eq("id", plannedEventId);

  revalidatePath("/admin");
  return { data: { id: newEvent.id, slug: newEvent.slug, admin_code: newEvent.admin_code } };
}
