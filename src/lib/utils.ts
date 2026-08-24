import { randomBytes } from "crypto";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format time in event's local timezone with timezone abbreviation
 * e.g., "6:00 PM MT"
 */
export function formatTime(date: string | Date, timezone: string = "America/Edmonton"): string {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  });
  
  // Get timezone abbreviation
  const tzFormatter = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "short",
    timeZone: timezone,
  });
  
  const parts = tzFormatter.formatToParts(d);
  const tzAbbr = parts.find((p) => p.type === "timeZoneName")?.value || "";
  
  return `${formatter.format(d)} ${tzAbbr}`;
}

export function formatDate(date: string | Date, timezone: string = "America/Edmonton"): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
}

export function isNow(startTime: string | null, endTime: string | null): boolean {
  if (!startTime || !endTime) return false;
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  return now >= start && now <= end;
}

export function isNext(
  startTime: string | null,
  allItems: { start_time: string | null; end_time: string | null }[]
): boolean {
  if (!startTime) return false;
  const now = new Date();
  const start = new Date(startTime);

  // If already started, not "next"
  if (now >= start) return false;

  // Find items that haven't started yet
  const futureItems = allItems
    .filter((item) => item.start_time && new Date(item.start_time) > now)
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());

  // Is this the next one?
  return futureItems[0]?.start_time === startTime;
}

/**
 * Get human-readable timer state for an agenda item
 * Returns: "Starts in 12m", "Live now", "Ended", or "Scheduled" (if event is in future)
 */
export function getTimerState(
  startTime: string | null,
  endTime: string | null,
  eventStartTime: string | null
): { state: "scheduled" | "starts-in" | "live" | "ended"; minutes?: number; text: string } | null {
  if (!startTime || !endTime) return null;
  
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  const eventStart = eventStartTime ? new Date(eventStartTime) : null;
  
  // If event hasn't started yet, show "Scheduled"
  if (eventStart && now < eventStart) {
    return { state: "scheduled", text: "Scheduled" };
  }
  
  if (now < start) {
    // Upcoming - show "Starts in Xm"
    const minutes = Math.floor((start.getTime() - now.getTime()) / 1000 / 60);
    return { state: "starts-in", minutes, text: `Starts in ${minutes}m` };
  } else if (now >= start && now < end) {
    // Live
    return { state: "live", text: "Live now" };
  } else {
    // Ended
    return { state: "ended", text: "Ended" };
  }
}

export function generatePasscode(): string {
  return randomBytes(8).toString("hex").toUpperCase();
}

export function generateAdminCode(): string {
  return randomBytes(16).toString("hex");
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
