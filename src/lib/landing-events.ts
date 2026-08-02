import { CursorEvent } from '@/lib/landing-types';
import { getEvents } from '@/content/events';

const EVENT_TZ = 'America/Edmonton';

export type LandingEventRow = {
  slug: string;
  name: string;
  venue: string | null;
  address: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  status: string;
  luma_url: string | null;
  landing_description: string | null;
  show_on_landing: boolean | null;
};

/** YYYY-MM-DD in the event timezone (calendar day, not UTC). */
export function calendarDateInTz(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export function resolveLandingStatus(date: string, at: Date = new Date()): 'upcoming' | 'past' {
  return date < calendarDateInTz(EVENT_TZ, at) ? 'past' : 'upcoming';
}

function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

function formatDisplayDate(
  startIso: string | null,
  endIso: string | null,
  timeZone: string
): { date: string; displayDate: string } {
  if (!startIso) {
    return { date: '', displayDate: '' };
  }

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(startIso));

  const dayLabel = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(startIso));

  const startClock = formatClock(startIso, timeZone);
  const endClock = endIso ? formatClock(endIso, timeZone) : null;
  const tzAbbrev = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  })
    .formatToParts(new Date(startIso))
    .find((part) => part.type === 'timeZoneName')?.value ?? 'MDT';

  const displayDate = endClock
    ? `${dayLabel} - ${startClock}-${endClock} ${tzAbbrev}`
    : `${dayLabel} - ${startClock} ${tzAbbrev}`;

  return { date, displayDate };
}

export function landingDescriptionFromNotes(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const cleaned = notes
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > 280 ? `${cleaned.slice(0, 277).trimEnd()}...` : cleaned;
}

export function mapDbEventToCursorEvent(row: LandingEventRow, at: Date = new Date()): CursorEvent | null {
  if (row.show_on_landing === false) return null;

  const timeZone = row.timezone || EVENT_TZ;
  const { date, displayDate } = formatDisplayDate(row.start_time, row.end_time, timeZone);
  if (!date) return null;

  const venue = row.venue?.trim() || 'Calgary';
  const location = venue.toLowerCase().includes('calgary')
    ? (venue.toLowerCase().includes('canada') ? venue : `${venue}, Canada`)
    : `${venue}, Calgary, Canada`;

  return {
    id: row.slug,
    title: row.name,
    date,
    displayDate,
    description: row.landing_description ?? undefined,
    location,
    lumaUrl: row.luma_url ?? undefined,
    portalPath: `/${row.slug}`,
    status: resolveLandingStatus(date, at),
  };
}

/**
 * DB events win for listing fields; static content fills gallery extras and
 * any historical events not yet present/complete in the database.
 */
export function mergeLandingEvents(
  dbEvents: CursorEvent[],
  at: Date = new Date()
): CursorEvent[] {
  const staticEvents = getEvents(at);
  const byId = new Map<string, CursorEvent>();

  for (const event of staticEvents) {
    byId.set(event.id, event);
  }

  for (const event of dbEvents) {
    const existing = byId.get(event.id);
    byId.set(event.id, {
      ...existing,
      ...event,
      thumbnail: existing?.thumbnail,
      galleryImages: existing?.galleryImages,
      attendees: existing?.attendees ?? event.attendees,
      description: event.description ?? existing?.description,
      lumaUrl: event.lumaUrl ?? existing?.lumaUrl,
      portalPath: event.portalPath ?? existing?.portalPath,
      displayDate: event.displayDate || existing?.displayDate || event.date,
    });
  }

  return Array.from(byId.values());
}

export function sortEventLinks(events: CursorEvent[]): CursorEvent[] {
  return events
    .filter((e) => e.lumaUrl || e.portalPath)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'upcoming' ? -1 : 1;
      if (a.status === 'upcoming') return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });
}

export function getUpcomingFromMerged(events: CursorEvent[]): CursorEvent[] {
  return events
    .filter((e) => e.status === 'upcoming')
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getPastFromMerged(events: CursorEvent[]): CursorEvent[] {
  return events
    .filter((e) => e.status === 'past')
    .sort((a, b) => b.date.localeCompare(a.date));
}
