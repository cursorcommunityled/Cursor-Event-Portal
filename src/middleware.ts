import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";

// Process-local cache so we don't hammer the DB on every admin request.
// Edge runtime is per-instance so this is best-effort, not authoritative.
const adminEmailCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();
const ADMIN_CACHE_TTL_MS = 60_000;

async function isAdminEmail(email: string): Promise<boolean> {
  const cached = adminEmailCache.get(email);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isAdmin;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If we cannot verify (e.g. local dev without service key), fail closed.
  if (!url || !serviceKey) return false;

  try {
    const admin = createPlainClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check both sources for backwards compatibility:
    //   1. public.admin_emails (canonical allow-list)
    //   2. public.users.role = 'admin' (legacy)
    const [allowList, userRow] = await Promise.all([
      admin.from("admin_emails").select("email").ilike("email", email).maybeSingle(),
      admin.from("users").select("role").ilike("email", email).maybeSingle(),
    ]);

    const isAdmin = Boolean(allowList.data) || userRow.data?.role === "admin";
    adminEmailCache.set(email, { isAdmin, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS });
    return isAdmin;
  } catch {
    // Fail closed on lookup errors so we don't accidentally grant admin.
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // Update Supabase auth session
  const response = await updateSession(request);

  // Protected routes for staff
  if (request.nextUrl.pathname.includes("/staff/")) {
    // Check for session cookie (simplified for MVP)
    const sessionCookie = request.cookies.get("portal_session");
    if (!sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Admin routes protection (except login page)
  if (request.nextUrl.pathname.startsWith("/admin") && !request.nextUrl.pathname.startsWith("/admin/login")) {
    // Create Supabase client to check auth
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) => {
              response.cookies.set(name, value);
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    // Authenticated — but is this user actually an admin?
    // Without this check, *any* logged-in Supabase auth user would have
    // access to /admin/*. Verify against the admin_emails allow-list.
    const email = user.email?.toLowerCase();
    if (!email || !(await isAdminEmail(email))) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("error", "not_admin");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
