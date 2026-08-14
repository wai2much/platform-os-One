// Component 4 — context management.
//
// The old loop appended every tool_result at up to 20,000 characters each and
// never looked back. A busy-floor question ("what's on, who's on it, what do
// they owe") could run three tools a hop for eight hops — a quarter of a
// million characters of JSON, re-sent and re-billed on every subsequent hop,
// with the actual question buried in the middle where models read worst.
//
// Three strategies, in the order they should be reached for:
//   1. right-size each observation at the source (cheapest — never grows)
//   2. mask stale observations, keeping the CALL visible (the model still
//      knows it already looked; it just stops paying for the answer)
//   3. compact — summarize old turns into one message (last resort, lossy)

import type { Block, ConvoMessage } from './types.ts';

export type ContextConfig = {
  /** Model window we are willing to fill, in tokens. */
  maxInputTokens: number;
  /** Fraction of that at which compaction kicks in. */
  compactAt: number;
  /** Recent messages always kept verbatim. */
  keepRecent: number;
  /** Hops after which an observation is masked. */
  maskAfterHops: number;
  /** Per-observation character ceiling. */
  maxObservationChars: number;
  /** Total observation characters allowed in the window before masking is forced. */
  observationBudgetChars: number;
};

export const DEFAULT_CONTEXT: ContextConfig = {
  maxInputTokens: 120_000,
  compactAt: 0.7,
  keepRecent: 8,
  maskAfterHops: 3,
  maxObservationChars: 6_000,
  observationBudgetChars: 40_000,
};

/** ~3.6 chars/token, biased to over-estimate. Budgeting should fail safe. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.6) + 1;
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b: Block) => {
        if (b?.type === 'text') return b.text ?? '';
        if (b?.type === 'tool_use') return `${b.name}(${JSON.stringify(b.input ?? {})})`;
        if (b?.type === 'tool_result') return String((b as Record<string, unknown>).content ?? '');
        return '';
      })
      .join('\n');
  }
  return content ? JSON.stringify(content) : '';
}

export function conversationTokens(messages: ConvoMessage[], system = ''): number {
  let total = estimateTokens(system);
  for (const m of messages) total += estimateTokens(textOf(m.content)) + 4;
  return total;
}

// ---------------------------------------------------------------------------
// Strategy 1 — right-size an observation at the source
// ---------------------------------------------------------------------------

/**
 * Truncate a tool result intelligently.
 *
 * Blunt `JSON.stringify(x).slice(0, 20000)` produces invalid JSON that ends
 * mid-token, which the model then has to guess at. For an array-bearing result
 * we drop ROWS and say how many were dropped, so what she reads stays valid
 * and she knows to narrow the query.
 */
export function packObservation(value: unknown, maxChars: number): string {
  let json = safeStringify(value);
  if (json.length <= maxChars) return json;

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = { ...(value as Record<string, unknown>) };
    const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
    if (arrayKey) {
      const rows = obj[arrayKey] as unknown[];
      let keep = rows.length;
      while (keep > 1) {
        keep = Math.floor(keep / 2);
        const candidate = safeStringify({
          ...obj,
          [arrayKey]: rows.slice(0, keep),
          truncated: {
            showing: keep,
            of: rows.length,
            note: 'Result was too large for context. Narrow the query (filter, or a smaller limit) to see the rest.',
          },
        });
        if (candidate.length <= maxChars) return candidate;
      }
    }
  }

  json = json.slice(0, Math.max(0, maxChars - 120));
  return `${json}\n…[truncated: result exceeded ${maxChars} characters. Narrow the query.]`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Strategy 2 — observation masking
// ---------------------------------------------------------------------------

const MASK = '[earlier result cleared to save context — re-run the tool if you still need it]';

/**
 * Blank out stale tool_result bodies in place, keeping every tool_use block.
 *
 * Errors are never masked: a failed approach the model forgets is a failed
 * approach the model repeats.
 */
export function maskStaleObservations(
  messages: ConvoMessage[],
  currentHop: number,
  config: ContextConfig,
): number {
  let masked = 0;
  let observationChars = 0;

  // Newest first, so the budget protects recent results and sheds old ones.
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!Array.isArray(message.content)) continue;

    for (const block of message.content as Array<Record<string, unknown>>) {
      if (block?.type !== 'tool_result') continue;
      const body = String(block.content ?? '');
      if (body === MASK) continue;

      const isError = body.includes('"error"') || block.is_error === true;
      const hop = Number(block._hop ?? currentHop);
      const stale = currentHop - hop >= config.maskAfterHops;
      observationChars += body.length;
      const overBudget = observationChars > config.observationBudgetChars;

      if (isError || body.length < 200) continue;
      if (stale || overBudget) {
        block.content = MASK;
        masked++;
        observationChars -= body.length;
      }
    }
  }
  return masked;
}

// ---------------------------------------------------------------------------
// Strategy 3 — compaction
// ---------------------------------------------------------------------------

export type CompactionResult = {
  messages: ConvoMessage[];
  compacted: boolean;
  masked: number;
  tokensBefore: number;
  tokensAfter: number;
};

export function manageContext(
  messages: ConvoMessage[],
  system: string,
  currentHop: number,
  config: ContextConfig = DEFAULT_CONTEXT,
): CompactionResult {
  const tokensBefore = conversationTokens(messages, system);
  const masked = maskStaleObservations(messages, currentHop, config);

  const budget = config.maxInputTokens * config.compactAt;
  let working = messages;
  let compacted = false;

  if (conversationTokens(working, system) > budget && working.length > config.keepRecent + 2) {
    const keep = Math.max(1, config.keepRecent);
    const head = working.slice(0, 1);
    let older = working.slice(1, working.length - keep);
    let recent = working.slice(working.length - keep);

    // A tool_result must never be orphaned from the tool_use that produced it,
    // or the Anthropic API rejects the whole request.
    while (recent.length && startsWithToolResult(recent[0])) {
      older = older.concat(recent.slice(0, 1));
      recent = recent.slice(1);
    }
    // Equally, an assistant turn ending in tool_use must keep its results.
    while (older.length && endsWithToolUse(older[older.length - 1])) {
      recent = older.slice(-1).concat(recent);
      older = older.slice(0, -1);
    }

    if (older.length) {
      working = [...head, { role: 'user', content: summarize(older) }, ...recent];
      compacted = true;
    }
  }

  return {
    messages: working,
    compacted,
    masked,
    tokensBefore,
    tokensAfter: conversationTokens(working, system),
  };
}

function startsWithToolResult(message: ConvoMessage): boolean {
  return Array.isArray(message.content) &&
    (message.content as Block[]).some((b) => b?.type === 'tool_result');
}

function endsWithToolUse(message: ConvoMessage): boolean {
  return Array.isArray(message.content) &&
    (message.content as Block[]).some((b) => b?.type === 'tool_use');
}

/**
 * Structural summary — deterministic, no extra model call.
 *
 * An LLM summarizer would read better, but it costs a round trip inside a
 * request that is already racing an Edge Function timeout. What must survive
 * is the shape: what was asked, what was looked up, what was CHANGED, and what
 * failed. Writes are listed individually and never elided — "I already raised
 * that invoice" is the one fact this agent cannot afford to forget.
 */
function summarize(messages: ConvoMessage[]): string {
  const asks: string[] = [];
  const lookups: string[] = [];
  const writes: string[] = [];
  const failures: string[] = [];

  for (const message of messages) {
    if (message.role === 'user' && typeof message.content === 'string') {
      asks.push(message.content.slice(0, 240));
      continue;
    }
    if (!Array.isArray(message.content)) continue;

    for (const block of message.content as Array<Record<string, unknown>>) {
      if (block?.type === 'tool_use') {
        const call = `${block.name}(${JSON.stringify(block.input ?? {}).slice(0, 160)})`;
        (WRITE_TOOLS.has(String(block.name)) ? writes : lookups).push(call);
      } else if (block?.type === 'tool_result') {
        const body = String(block.content ?? '');
        if (body.includes('"error"')) failures.push(body.slice(0, 200));
      }
    }
  }

  const parts = ['[earlier in this conversation]'];
  if (asks.length) parts.push(`Asked: ${asks.slice(-4).join(' | ')}`);
  if (lookups.length) {
    const shown = lookups.slice(-12);
    parts.push(`Looked up (${lookups.length} calls, last ${shown.length}): ${shown.join(', ')}`);
  }
  if (writes.length) parts.push(`CHANGES ALREADY MADE — do not repeat these: ${writes.join(', ')}`);
  if (failures.length) parts.push(`Failed, do not retry blindly: ${failures.slice(-4).join(' | ')}`);
  return parts.join('\n');
}

/** Tools that change the world. Kept in sync with mercedes/tools.ts risk levels. */
export const WRITE_TOOLS = new Set(['update_job', 'create_invoice', 'remember']);
