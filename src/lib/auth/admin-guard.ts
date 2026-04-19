import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Shared admin authorisation guard for /api/admin/* route handlers.
 *
 * Authorisation succeeds if any one of the following is true:
 *
 *   1. The request carries a valid Supabase auth session whose email is
 *      in `public.admin_emails` (or whose `users.role = 'admin'`).
 *   2. The legacy `portal_session` cookie belongs to a user with
 *      `role = 'admin'`.
 *   3. The request supplies the per-event `adminCode` (header
 *      `x-admin-code` / `x-event-id`, or `adminCode` + `eventId` in the
 *      JSON/form body) and it matches the event row.
 *
 * Returns either an authorised context object or a `NextResponse` that
 * the caller should return immediately. Always fails closed.
 *
 * Usage:
 *   const auth = await requireAdmin(req, { eventId });
 *   if ("response" in auth) return auth.response;
 *   // ... continue, optionally using auth.method for audit logging
 */
export type AdminAuth =
  | { method: "supabase_auth"; userId: string; email: string }
  | { method: "portal_session"; userId: string }
  | { method: "admin_code"; eventId: string };

export type AdminAuthOptions = {
  /**
   * If supplied, the adminCode path will be validated against this event id.
   * If omitted, the helper will try to read the eventId from the request
   * (header `x-event-id`, JSON body `eventId`, form field `eventId`).
   */
  eventId?: string;
  /**
   * If true, do not allow `adminCode` as an auth method. Use this for
   * destructive operations that should require a human admin session.
   */
  requireUserSession?: boolean;
};

export async function requireAdmin(
  request: NextRequest,
  options: AdminAuthOptions = {}
): Promise<AdminAuth | { response: NextResponse }> {
  const supabase = await createServiceClient();

  // ------- 1) Supabase auth session (admin email allow-list) -------
  try {
    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anon) {
      const ssr = createServerClient(url, anon, {
        cookies: {
          getAll: () => cookieStore.getAll(),
          // No-op setAll: we don't refresh tokens from API routes here.
          setAll: (_: { name: string; value: string; options?: CookieOptions }[]) => {},
        },
      });
      const { data: { user } } = await ssr.auth.getUser();
      if (user?.email) {
        const email = user.email.toLowerCase();
        const [allow, row] = await Promise.all([
          supabase.from("admin_emails").select("email").ilike("email", email).maybeSingle(),
          supabase.from("users").select("id, role").ilike("email", email).maybeSingle(),
        ]);
        const isAdmin = Boolean(allow.data) || row.data?.role === "admin";
        if (isAdmin) {
          return {
            method: "supabase_auth",
            userId: row.data?.id ?? user.id,
            email,
          };
        }
      }
    }
  } catch {
    // Fall through to other auth methods.
  }

  // ------- 2) Legacy portal_session cookie + users.role = 'admin' -------
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("portal_session");
    if (sessionCookie) {
      const session = JSON.parse(sessionCookie.value) as { userId?: string; exp?: number };
      if (session.userId && (!session.exp || session.exp > Date.now())) {
        const { data: user } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.userId)
          .maybeSingle();
        if (user?.role === "admin") {
          return { method: "portal_session", userId: session.userId };
        }
      }
    }
  } catch {
    // Fall through.
  }

  // ------- 3) Per-event admin code -------
  if (!options.requireUserSession) {
    const adminCode =
      request.headers.get("x-admin-code") ?? (await readBodyField(request, "adminCode"));
    const headerEventId =
      request.headers.get("x-event-id") ?? (await readBodyField(request, "eventId"));
    const eventId = options.eventId ?? headerEventId ?? null;

    if (adminCode && eventId) {
      const { data: event } = await supabase
        .from("events")
        .select("id, admin_code")
        .eq("id", eventId)
        .maybeSingle();
      if (event && event.admin_code && event.admin_code === adminCode) {
        return { method: "admin_code", eventId: event.id };
      }
    }
  }

  return {
    response: NextResponse.json(
      { error: "Admin access required" },
      { status: 401 }
    ),
  };
}

/**
 * Best-effort body field reader that does NOT consume the body — it clones
 * the request first so the original handler can still read it.
 *
 * Falls back to null on any error (binary uploads, bad JSON, etc).
 */
async function readBodyField(req: NextRequest, field: string): Promise<string | null> {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const cloned = req.clone();

    if (contentType.includes("application/json")) {
      const body = await cloned.json().catch(() => null);
      const value = body && typeof body === "object" ? (body as Record<string, unknown>)[field] : null;
      return typeof value === "string" ? value : null;
    }

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await cloned.formData().catch(() => null);
      const value = form?.get(field);
      return typeof value === "string" ? value : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}
