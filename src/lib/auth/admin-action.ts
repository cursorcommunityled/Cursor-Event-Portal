import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

/**
 * Admin authorisation helper for **server actions** (not API routes — for
 * those use `requireAdmin` from `./admin-guard.ts`).
 *
 * Authorisation succeeds if any one of the following is true:
 *
 *   1. The caller has a signed `portal_session` cookie belonging to a user
 *      with `users.role = 'admin'`.
 *   2. The caller passes the per-event `adminCode` and it matches the
 *      target event row (URL-based auth used by `/admin/[adminCode]`
 *      pages, where the operator never has a `portal_session`).
 *
 * Returns `null` on success, or `{ error: string }` the action should
 * bubble up to the client. Always fails closed.
 *
 * Use it as the very first line of any admin-only server action that may
 * be invoked from a `/admin/[adminCode]/...` page:
 *
 *     const authError = await requireEventAdmin(eventId, adminCode);
 *     if (authError) return authError;
 */
export async function requireEventAdmin(
  eventId: string,
  adminCode?: string | null
): Promise<{ error: string } | null> {
  const supabase = await createServiceClient();

  // 1) Signed portal_session admin user
  const session = await getSession();
  if (session) {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();
    if (user?.role === "admin") return null;
  }

  // 2) Per-event admin code
  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .maybeSingle();
    if (event?.admin_code && event.admin_code === adminCode) return null;
  }

  return { error: "Not authenticated" };
}

/**
 * Like `requireEventAdmin` but for **global** admin actions that aren't
 * scoped to a specific event (e.g. creating planned events, venues,
 * conversation themes, scraping Luma URLs).
 *
 * Authorisation succeeds if any one of the following is true:
 *
 *   1. The caller has a signed `portal_session` cookie belonging to a user
 *      with `users.role = 'admin'`.
 *   2. The caller passes an `adminCode` that matches **any** event row
 *      (i.e. they're already authenticated as an admin of *some* event,
 *      so they're allowed to manage shared resources).
 *
 * Returns `null` on success, or `{ error: string }` the action should
 * bubble up. Always fails closed.
 */
export async function requireAnyAdmin(
  adminCode?: string | null
): Promise<{ error: string } | null> {
  const supabase = await createServiceClient();

  const session = await getSession();
  if (session) {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();
    if (user?.role === "admin") return null;
  }

  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("admin_code", adminCode)
      .maybeSingle();
    if (event) return null;
  }

  return { error: "Not authenticated" };
}
