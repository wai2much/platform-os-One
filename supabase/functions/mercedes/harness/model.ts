// Components 2/5/6 at the wire — the Anthropic client.
//
// What this adds over the old raw fetch:
//   * an abort timeout, so a slow call cannot hold the Edge Function open
//     until the platform kills it with no reply at all
//   * transient-only retry with Retry-After honoured (429/529 are routine)
//   * prompt caching preserved exactly as before — persona and tool schemas are
//     identical on every hop, and re-billing them was the old loop's main cost
//   * cache-usage reported, so the saving is visible instead of assumed

import { DEFAULT_RETRY, HarnessError, retryAfterMs, TransientError, withRetry } from './errors.ts';
import type { ConvoMessage, ToolSchema } from './types.ts';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export type ModelResponse = {
  content: Array<Record<string, unknown>>;
  stop_reason: string;
  usage: Record<string, unknown>;
};

export type ModelCallOptions = {
  apiKey: string;
  model: string;
  system: string;
  tools: ToolSchema[];
  messages: ConvoMessage[];
  maxTokens: number;
  /** Milliseconds left in the whole run — the request timeout tracks it. */
  remainingMs: () => number;
  cache?: boolean;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
};

/**
 * Strip harness-private bookkeeping from content blocks before they go over
 * the wire.
 *
 * The harness annotates each tool_result with `_hop` so the context masker
 * knows what has gone stale. The Anthropic API validates content blocks
 * strictly and rejects ANY field it does not recognise:
 *
 *   messages.2.content.0.tool_result._hop: Extra inputs are not permitted
 *
 * That is a hard 400 on the second hop of every tool-using conversation — it
 * took a live call to find, because a stubbed endpoint accepts anything. The
 * annotation stays on the local conversation (masking needs it); it just
 * never leaves the process. Any future `_`-prefixed field is covered too.
 */
export function stripPrivateFields(messages: ConvoMessage[]): ConvoMessage[] {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) return message;

    let touched = false;
    const blocks = (message.content as Array<Record<string, unknown>>).map((block) => {
      if (!block || typeof block !== 'object') return block;
      const priv = Object.keys(block).filter((k) => k.startsWith('_'));
      if (!priv.length) return block;
      touched = true;
      const clean = { ...block };
      for (const k of priv) delete clean[k];
      return clean;
    });

    return touched ? { ...message, content: blocks } : message;
  });
}

export async function callModel(opts: ModelCallOptions): Promise<ModelResponse> {
  const doFetch = opts.fetchImpl ?? fetch;
  const cache = opts.cache !== false;

  const body = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    // Persona and tool schemas are byte-identical every hop. Marking the tail
    // of each as ephemeral means a ten-hop conversation pays for the preamble
    // once instead of ten times.
    system: cache
      ? [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }]
      : opts.system,
    tools: cache && opts.tools.length
      ? opts.tools.map((t, i) =>
        i === opts.tools.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t
      )
      : opts.tools,
    messages: stripPrivateFields(opts.messages),
    // No temperature: recent Claude models reject it on this endpoint —
    // "`temperature` is deprecated for this model" → 400 on every call.
  };

  return await withRetry(async () => {
    // Never let one call outlive the run's remaining budget: a reply that says
    // "that took too long" beats the platform killing the function silently.
    const budget = Math.max(2_000, Math.min(opts.remainingMs() - 500, 60_000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budget);

    let res: Response;
    try {
      res = await doFetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const snippet = text.slice(0, 300);

      if (res.status === 401 || res.status === 403) {
        throw new HarnessError(
          'Mercedes could not authenticate with Anthropic. Check ANTHROPIC_API_KEY in Supabase → Edge Functions → Secrets.',
          { errorClass: 'user_fixable', status: res.status },
        );
      }
      if (res.status === 400) {
        // Our request was malformed — retrying sends the same bad request.
        throw new HarnessError(`Anthropic rejected the request: ${snippet}`, {
          errorClass: 'unexpected',
          status: 400,
        });
      }
      if (res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500) {
        throw new TransientError(`Anthropic ${res.status}: ${snippet}`, {
          status: res.status,
          retryAfterMs: retryAfterMs(res.headers),
        });
      }
      throw new HarnessError(`Anthropic ${res.status}: ${snippet}`, {
        errorClass: 'unexpected',
        status: res.status,
      });
    }

    const data = await res.json();
    return {
      content: (data.content ?? []) as Array<Record<string, unknown>>,
      stop_reason: String(data.stop_reason ?? 'end_turn'),
      usage: (data.usage ?? {}) as Record<string, unknown>,
    };
  }, { ...DEFAULT_RETRY, budgetMs: opts.remainingMs }, opts.onRetry);
}
