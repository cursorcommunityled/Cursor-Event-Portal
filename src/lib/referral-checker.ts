/**
 * Cursor referral code checker — ported from cursor-referral-checker.
 * POSTs to Cursor's check-referral-code API and classifies responses.
 */

export type ReferralCheckStatus =
  | "available"
  | "used"
  | "invalid"
  | "error"
  | "unknown";

export type ReferralCheckResult = {
  code: string;
  status: ReferralCheckStatus;
  message: string;
  value: string;
};

const API_URL = "https://cursor.com/api/dashboard/check-referral-code";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const DEFAULT_CONCURRENCY = 10;

const USED_PATTERNS = [
  /already been (used|redeemed|claimed)/i,
  /code has been used up/i,
  /maximum number of times/i,
  /only be redeemed once/i,
];

const INVALID_PATTERNS = [
  /couldn.t (use|find|apply|verify)/i,
  /couldn.t find that referral/i,
  /not found|does not exist|doesn.t exist/i,
  /invalid.{0,10}(code|referral|link)/i,
  /expired/i,
];

type ApiPayload = {
  isValid?: boolean;
  userIsEligible?: boolean;
  maxRedemptions?: unknown;
  metadata?: { title?: string; description?: string };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function extractValue(data: ApiPayload) {
  const title = data.metadata?.title ?? "";
  const description = data.metadata?.description ?? "";
  const combined = `${title} ${description}`;

  const dollarMatch = combined.match(/\$[\d,.]+/);
  if (dollarMatch) return dollarMatch[0];

  const percentMatch = combined.match(/\d+(?:\.\d+)?%/);
  if (percentMatch) return percentMatch[0];

  return "";
}

/** Exported for unit-style dry-runs against sample API shapes. */
export function classifyApiResponse(data: unknown): {
  status: ReferralCheckStatus;
  message: string;
  value: string;
} {
  if (!data || typeof data !== "object") {
    return { status: "error", message: "Empty API response", value: "" };
  }

  const payload = data as ApiPayload;

  if (Object.keys(payload).length === 0) {
    return { status: "invalid", message: "Invalid referral code", value: "" };
  }

  const title = payload.metadata?.title ?? "";
  const description = payload.metadata?.description ?? "";
  const combined = `${title} ${description}`.trim();
  const value = extractValue(payload);

  if (payload.maxRedemptions) {
    return {
      status: "used",
      message: description || title || "Maximum redemptions reached",
      value,
    };
  }

  if (payload.isValid === true) {
    if (payload.userIsEligible === true) {
      return {
        status: "available",
        message: description || title || "Valid referral code",
        value,
      };
    }
    return {
      status: "used",
      message: description || title || "Not eligible",
      value,
    };
  }

  const used = matchFirst(combined, USED_PATTERNS);
  if (used) {
    return { status: "used", message: title || description || used, value };
  }

  const invalid = matchFirst(combined, INVALID_PATTERNS);
  if (invalid) {
    return { status: "invalid", message: title || description || invalid, value };
  }

  if (payload.isValid === false) {
    return {
      status: "invalid",
      message: title || description || "Invalid referral code",
      value,
    };
  }

  if (combined) {
    return { status: "unknown", message: combined, value };
  }

  return { status: "unknown", message: "Could not classify API response", value: "" };
}

export async function checkReferralCode(
  code: string,
  attempt = 1
): Promise<ReferralCheckResult> {
  const normalized = code.trim();
  if (!normalized) {
    return { code, status: "error", message: "Empty code", value: "" };
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://cursor.com",
        referer: `https://cursor.com/referral?code=${encodeURIComponent(normalized)}`,
        "user-agent": "Mozilla/5.0 (compatible; cursor-referral-checker/1.0)",
      },
      body: JSON.stringify({ referralCode: normalized }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text();
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt <= MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        return checkReferralCode(normalized, attempt + 1);
      }
      return {
        code: normalized,
        status: "error",
        message: `HTTP ${res.status}: ${text.slice(0, 120)}`,
        value: "",
      };
    }

    const data = await res.json();
    const classified = classifyApiResponse(data);
    return { code: normalized, ...classified };
  } catch (err) {
    if (attempt <= MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS * attempt);
      return checkReferralCode(normalized, attempt + 1);
    }
    return {
      code: normalized,
      status: "error",
      message: err instanceof Error ? err.message : String(err),
      value: "",
    };
  }
}

export async function checkReferralCodes(
  codes: string[],
  concurrency = DEFAULT_CONCURRENCY
): Promise<ReferralCheckResult[]> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const results: ReferralCheckResult[] = [];

  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((code) => checkReferralCode(code)));
    results.push(...batchResults);
  }

  // One more pass for unknown/error with lower concurrency
  for (let retry = 1; retry <= MAX_RETRIES; retry++) {
    const retryable = results.filter(
      (r) => r.status === "unknown" || r.status === "error"
    );
    if (retryable.length === 0) break;

    const retryResults = await Promise.all(
      retryable.map((r) => checkReferralCode(r.code))
    );
    const retryMap = new Map(retryResults.map((r) => [r.code, r]));
    for (let i = 0; i < results.length; i++) {
      const updated = retryMap.get(results[i].code);
      if (updated) results[i] = updated;
    }
  }

  return results;
}

export function referralUrlForCode(code: string) {
  return `https://cursor.com/referral?code=${code}`;
}
