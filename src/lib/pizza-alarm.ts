/** Announcement copy used to fan out the pizza alarm to attendees. */
export const PIZZA_ALARM_ANNOUNCEMENT = "Pizza has arrived — grab a slice!";

export function isPizzaAnnouncement(content: string | null | undefined) {
  if (!content) return false;
  const normalized = content.trim().toLowerCase();
  return (
    normalized === PIZZA_ALARM_ANNOUNCEMENT.toLowerCase() ||
    normalized.includes("pizza has arrived")
  );
}
