import { AsyncLocalStorage } from "async_hooks";
import type { NextRequest } from "next/server";
import {
  parsePortalSession,
  type PortalSession,
} from "@/lib/auth/portal-session";

export const portalSessionALS = new AsyncLocalStorage<PortalSession>();

export function getMobileSessionFromRequest(
  request: NextRequest
): PortalSession | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) return null;

  return parsePortalSession(match[1].trim());
}

export function runWithPortalSession<T>(
  session: PortalSession,
  fn: () => Promise<T>
): Promise<T> {
  return portalSessionALS.run(session, fn);
}

export async function withMobileSession(
  request: NextRequest,
  handler: (session: PortalSession) => Promise<Response>
): Promise<Response> {
  const session = getMobileSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  return runWithPortalSession(session, () => handler(session));
}
