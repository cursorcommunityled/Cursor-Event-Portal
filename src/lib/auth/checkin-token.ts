import { createHmac, timingSafeEqual } from "crypto";

const CHECK_IN_TOKEN_TTL_MS = 10 * 60 * 1000;

type CheckInTokenPayload = {
  eventId: string;
  attendeeId: string;
  exp: number;
};

export function createCheckInToken(eventId: string, attendeeId: string): string {
  const payload: CheckInTokenPayload = {
    eventId,
    attendeeId,
    exp: Date.now() + CHECK_IN_TOKEN_TTL_MS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyCheckInToken(
  token: unknown,
  eventId: string,
  attendeeId: string
): boolean {
  if (typeof token !== "string") return false;

  const [encodedPayload, signature, ...extraParts] = token.split(".");
  if (!encodedPayload || !signature || extraParts.length > 0) return false;
  if (!constantTimeEquals(signature, sign(encodedPayload))) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<CheckInTokenPayload>;

    return (
      payload.eventId === eventId &&
      payload.attendeeId === attendeeId &&
      typeof payload.exp === "number" &&
      payload.exp > Date.now()
    );
  } catch {
    return false;
  }
}

function sign(value: string): string {
  return createHmac("sha256", getTokenSecret()).update(value).digest("base64url");
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function getTokenSecret(): string {
  const secret =
    process.env.CHECKIN_TOKEN_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing check-in token secret");
  }

  return secret;
}
