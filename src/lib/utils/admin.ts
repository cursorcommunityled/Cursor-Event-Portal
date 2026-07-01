import { getEventBySlug, getEventByAdminCode } from "@/lib/supabase/queries";
import { notFound } from "next/navigation";

/**
 * Get event by adminCode alone — used by the simplified /admin/[adminCode] routes.
 * Calls notFound() if no matching event exists.
 */
export async function getEventForAdmin(adminCode: string) {
  const event = await getEventByAdminCode(adminCode);
  if (!event) notFound();
  return event;
}

/**
 * Legacy: validates eventSlug + adminCode match. Kept for any remaining references.
 */
export async function validateAdminCode(
  eventSlug: string,
  adminCode: string
) {
  const event = await getEventBySlug(eventSlug, { includePrivate: true });
  if (!event) notFound();
  if (event.admin_code !== adminCode) notFound();
  return event;
}
