/**
 * Shared Anthropic retry helper for AI screening passes.
 * Retries 429 / 503 / 529 and common network failures with exponential backoff.
 */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAnthropicError(error: unknown): boolean {
  const e = error as {
    status?: number;
    statusCode?: number;
    code?: string;
    message?: string;
    error?: { type?: string };
  };
  const status = e.status ?? e.statusCode;
  if (status === 429 || status === 503 || status === 529 || status === 408) return true;

  const msg = (e.message ?? '').toLowerCase();
  if (
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up') ||
    msg.includes('network')
  ) {
    return true;
  }

  if (e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'EAI_AGAIN') {
    return true;
  }

  return e.error?.type === 'overloaded_error' || e.error?.type === 'rate_limit_error';
}

export async function withAnthropicRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; label?: string }
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts - 1 || !isRetryableAnthropicError(error)) {
        throw error;
      }
      const waitMs = (attempt + 1) ** 2 * 1000;
      console.warn(
        `[anthropic-retry] ${opts?.label ?? 'call'} attempt ${attempt + 1}/${maxAttempts} failed; waiting ${waitMs}ms`,
        error instanceof Error ? error.message : error
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
}

export function isRateLimitError(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: number; message?: string };
  const status = e.status ?? e.statusCode;
  if (status === 429 || status === 529) return true;
  return /rate limit|overloaded/i.test(e.message ?? '');
}
