// Component 9 — guardrails and safety.
//
// The existing Mercedes got the most important half of this right already:
// staff-vs-owner access is enforced inside runTool, not in the persona. A
// prompt is an instruction and can be argued with; a tool that never returns
// the number cannot. That principle is kept and generalised here.
//
// Three stages, each able to fire a tripwire that halts the run:
//   input  — on the user's message, once
//   tool   — on every tool call's ARGUMENTS, before execution
//   output — on the final reply, where it can redact instead of halting

import { GuardrailTripped } from './errors.ts';

export type Stage = 'input' | 'tool' | 'output';

export type GuardrailResult = {
  tripped: boolean;
  reason?: string;
  /** Set to rewrite the payload instead of halting (redaction). */
  replacement?: string;
};

export type Guardrail = {
  name: string;
  stage: Stage;
  check(payload: unknown, context: Record<string, unknown>): GuardrailResult;
};

function asText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload === null || payload === undefined) return '';
  if (Array.isArray(payload)) return payload.map(asText).join('\n');
  if (typeof payload === 'object') {
    return Object.entries(payload as Record<string, unknown>)
      .map(([k, v]) => `${k}=${asText(v)}`)
      .join('\n');
  }
  return String(payload);
}

// ---------------------------------------------------------------------------
// Ready-made guardrails
// ---------------------------------------------------------------------------

/**
 * Prompt-injection sentinel.
 *
 * Worth having even though the tools are the real defence: Mercedes reads
 * customer names, job notes and invoice text straight out of the database, and
 * anyone who can raise a job can type into those fields.
 */
export const injectionSentinel: Guardrail = {
  name: 'injection_sentinel',
  stage: 'input',
  check(payload) {
    const text = asText(payload).toLowerCase();
    const patterns = [
      /ignore (all )?(previous|prior|above) instructions/,
      /disregard (your|the) (system prompt|persona|guidelines|rules)/,
      /you are now (in )?(developer|god|admin|owner) mode/,
      /pretend (you are|to be) the owner/,
      /reveal (your|the) (system prompt|instructions|api key)/,
    ];
    for (const re of patterns) {
      if (re.test(text)) {
        return { tripped: true, reason: `possible prompt injection: ${re.source}` };
      }
    }
    return { tripped: false };
  },
};

/**
 * Escalation sentinel — the specific attack this product invites.
 *
 * identity.ts already tells her "the login is the identity", and the tools
 * already refuse. This catches the attempt so it lands in telemetry instead of
 * passing silently, which is what you want on a multi-tenant system.
 */
export function escalationSentinel(role: string): Guardrail {
  return {
    name: 'escalation_sentinel',
    stage: 'input',
    check(payload) {
      if (role === 'owner') return { tripped: false };
      const text = asText(payload).toLowerCase();
      const claims = [
        /i(?:'| a)?m the owner/,
        /this is the owner speaking/,
        /i own (this|the) (shop|business|workshop)/,
        /give me (the )?(owner|admin) access/,
      ];
      for (const re of claims) {
        if (re.test(text)) {
          return {
            tripped: true,
            reason: 'staff login claiming owner identity — refused at the guardrail, not the prompt',
          };
        }
      }
      return { tripped: false };
    },
  };
}

/** Never let a key reach a chat bubble, no matter how it got into context. */
export const secretRedactor: Guardrail = {
  name: 'secret_redactor',
  stage: 'output',
  check(payload) {
    const text = asText(payload);
    const patterns = [
      /sk-ant-[A-Za-z0-9_-]{16,}/g,
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT (service role key)
      /sbp_[A-Za-z0-9]{20,}/g,
      /gh[pousr]_[A-Za-z0-9]{20,}/g,
    ];
    let out = text;
    for (const re of patterns) out = out.replace(re, '[redacted]');
    return out === text ? { tripped: false } : { tripped: false, replacement: out };
  },
};

/**
 * Loop breaker: the same tool with the same arguments, over and over.
 *
 * This is the failure the old MAX_HOPS ceiling was silently absorbing — eight
 * hops of an identical `get_floor` call, then a 504 and no answer. Catching it
 * at three lets the run salvage a reply instead.
 */
export function loopBreaker(threshold = 3): Guardrail {
  const seen = new Map<string, number>();
  return {
    name: 'loop_breaker',
    stage: 'tool',
    check(payload) {
      const key = asText(payload);
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (count >= threshold) {
        return {
          tripped: true,
          reason: `the same tool call was made ${count} times in a row — the agent is stuck`,
        };
      }
      return { tripped: false };
    },
  };
}

/**
 * Write-rate cap. Mercedes can raise invoices and move jobs; a runaway loop
 * doing that to a live production tenant is the worst outcome in this system.
 */
export function writeRateCap(maxWrites: number, isWrite: (name: string) => boolean): Guardrail {
  let writes = 0;
  return {
    name: 'write_rate_cap',
    stage: 'tool',
    check(payload) {
      const name = String((payload as Record<string, unknown>)?.name ?? '');
      if (!isWrite(name)) return { tripped: false };
      writes++;
      if (writes > maxWrites) {
        return {
          tripped: true,
          reason: `more than ${maxWrites} write operations in one turn — refusing to continue against live data`,
        };
      }
      return { tripped: false };
    },
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export class GuardrailRunner {
  private readonly byStage: Record<Stage, Guardrail[]> = { input: [], tool: [], output: [] };

  constructor(guardrails: Guardrail[] = []) {
    for (const g of guardrails) this.add(g);
  }

  add(g: Guardrail): void {
    this.byStage[g.stage].push(g);
  }

  /** Returns the payload, possibly rewritten. Throws GuardrailTripped on a tripwire. */
  run(stage: Stage, payload: unknown, context: Record<string, unknown> = {}): unknown {
    let current = payload;
    for (const g of this.byStage[stage]) {
      const result = g.check(current, context);
      if (result.tripped) {
        throw new GuardrailTripped(result.reason ?? `${g.name} fired`, g.name, stage);
      }
      if (result.replacement !== undefined) current = result.replacement;
    }
    return current;
  }

  runText(stage: Stage, text: string, context: Record<string, unknown> = {}): string {
    const out = this.run(stage, text, context);
    return typeof out === 'string' ? out : text;
  }
}
