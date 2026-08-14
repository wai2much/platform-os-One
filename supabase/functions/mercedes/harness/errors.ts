// Component 8 — error handling.
//
// The gap this closes: agent.ts threw on any non-2xx from Anthropic, so a
// single 429 or 529 ("overloaded", which Anthropic returns routinely under
// load) killed the whole chat with a 500. Nothing about that failure was the
// user's fault and nothing about it was permanent.
//
// Four classes, and the class decides who fixes it:
//   transient       -> the harness retries, with backoff and Retry-After
//   llm_recoverable -> hand it back to Claude as an observation, she adjusts
//   user_fixable    -> tell the person plainly (bad key, no org, denied)
//   unexpected      -> a real bug; let it surface rather than papering over

export type ErrorClass = 'transient' | 'llm_recoverable' | 'user_fixable' | 'unexpected';

export class HarnessError extends Error {
  readonly errorClass: ErrorClass;
  readonly status?: number;
  readonly detail?: string;

  constructor(
    message: string,
    opts: { errorClass?: ErrorClass; status?: number; detail?: string } = {},
  ) {
    super(message);
    this.name = 'HarnessError';
    this.errorClass = opts.errorClass ?? 'unexpected';
    this.status = opts.status;
    this.detail = opts.detail;
  }
}

export class TransientError extends HarnessError {
  constructor(message: string, opts: { status?: number; retryAfterMs?: number } = {}) {
    super(message, { errorClass: 'transient', status: opts.status });
    this.name = 'TransientError';
    this.retryAfterMs = opts.retryAfterMs;
  }
  retryAfterMs?: number;
}

export class GuardrailTripped extends HarnessError {
  readonly guardrail: string;
  readonly stage: string;
  constructor(message: string, guardrail: string, stage: string) {
    super(message, { errorClass: 'user_fixable' });
    this.name = 'GuardrailTripped';
    this.guardrail = guardrail;
    this.stage = stage;
  }
}

/** 408/409/429 and 5xx are worth another go. 4xx otherwise means we asked wrong. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function classify(err: unknown): ErrorClass {
  if (err instanceof HarnessError) return err.errorClass;
  const name = (err as Error)?.name?.toLowerCase() ?? '';
  const msg = (err as Error)?.message?.toLowerCase() ?? '';
  // Deno's fetch surfaces network trouble as TypeError with a generic message,
  // and an AbortError when our own timeout fires. Both are worth retrying.
  if (name === 'aborterror' || name === 'timeouterror') return 'transient';
  if (name === 'typeerror' && (msg.includes('network') || msg.includes('connection') ||
      msg.includes('sending request') || msg.includes('fetch'))) return 'transient';
  if (msg.includes('overloaded') || msg.includes('rate limit')) return 'transient';
  return 'unexpected';
}

export type RetryConfig = {
  /** Total attempts, not extra attempts. Stripe's production harness caps at 2. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Never sleep past this — an Edge Function has a hard wall to respect. */
  budgetMs?: () => number;
};

export const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 400,
  maxDelayMs: 4_000,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn`, retrying ONLY transient failures.
 *
 * Retrying an llm_recoverable error is worse than useless: it burns the wall
 * clock and Claude never learns the call was wrong.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (classify(err) !== 'transient' || attempt >= config.maxAttempts) throw err;

      const hinted = err instanceof TransientError ? err.retryAfterMs : undefined;
      let delay = hinted ?? Math.min(config.baseDelayMs * 2 ** (attempt - 1), config.maxDelayMs);
      delay = Math.round(delay * (0.5 + Math.random())); // jitter

      // Do not sleep into the platform's timeout — failing now with a real
      // message beats being killed mid-sleep with none.
      const remaining = config.budgetMs?.();
      if (remaining !== undefined && delay > remaining - 1_000) throw err;

      onRetry?.(attempt, err, delay);
      await sleep(delay);
    }
  }
}

/** Parse Retry-After (seconds, or an HTTP date) into milliseconds. */
export function retryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(raw);
  return Number.isFinite(when) ? Math.max(0, when - Date.now()) : undefined;
}
