import { createHmac, timingSafeEqual } from "crypto";

export const PORTAL_SESSION_COOKIE_NAME = "portal_session";

export type PortalSession = {
  userId: string;
  eventId: string;
  exp: number;
  role?: string;
  userName?: string;
  userEmail?: string | null;
};

export function serializePortalSession(session: PortalSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parsePortalSession(value: string | undefined | null): PortalSession | null {
  if (!value || value.length > 4096) return null;

  const [payload, signature, ...extraParts] = value.split(".");
  if (!payload || !signature || extraParts.length > 0) return null;

  try {
    if (!constantTimeEquals(signature, sign(payload))) return null;

    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Partial<PortalSession>;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.eventId !== "string" ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }

    return parsed as PortalSession;
  } catch {
    return null;
  }
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function getSessionSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET;

  if (!secret) {
    throw new Error("Missing PORTAL_SESSION_SECRET");
  }

  return secret;
}
