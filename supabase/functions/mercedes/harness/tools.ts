// Component 2 — tools.
//
// The old tools.ts did the important thing right: it enforced role access
// inside the tool, not the prompt. What it lacked was a layer around the tools
// — argument validation, per-call timeouts, risk classification, and results
// packed to a sane size. All of that is here, so mercedes/tools.ts can stay
// pure business logic.
//
// Risk drives three separate decisions: whether a call can run concurrently,
// whether it counts against the write cap, and whether it gets verified after.

import { HarnessError } from './errors.ts';
import { packObservation } from './context.ts';
import type { ToolSchema } from './types.ts';

export type Risk = 'read' | 'write' | 'high';

export type ToolContext = {
  orgId: string;
  userId: string | null;
  role: string;
};

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<unknown> | unknown;

/** Runs after a successful write and confirms it actually landed. */
export type PostCondition = (
  result: unknown,
  input: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<{ ok: boolean; detail?: string }>;

export type ToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  risk: Risk;
  handler: ToolHandler;
  /** Roles allowed to call it at all. Undefined means everyone. */
  allowRoles?: string[];
  timeoutMs?: number;
  maxResultChars?: number;
  verify?: PostCondition;
};

export type ToolOutcome = {
  name: string;
  callId: string;
  content: string;
  isError: boolean;
  durationMs: number;
  risk: Risk;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDef>();

  constructor(tools: ToolDef[] = []) {
    for (const t of tools) this.register(t);
  }

  register(tool: ToolDef): void {
    if (this.tools.has(tool.name)) throw new Error(`duplicate tool: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  isWrite(name: string): boolean {
    const risk = this.tools.get(name)?.risk;
    return risk === 'write' || risk === 'high';
  }

  /**
   * Schemas for the API, scoped to what this role may actually use.
   *
   * Showing a staff login a tool that will always refuse wastes window and
   * invites an argument. Not showing it is cleaner than denying it.
   */
  schemas(role: string): ToolSchema[] {
    const out: ToolSchema[] = [];
    for (const tool of this.tools.values()) {
      if (tool.allowRoles && !tool.allowRoles.includes(role)) continue;
      out.push({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      });
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate and coerce arguments against the declared schema.
 *
 * Claude occasionally sends "25" where the schema says integer, or omits a
 * required field. Both used to reach the Supabase query as-is; now they come
 * back as a readable error she can correct on the next hop.
 */
export function validateArgs(
  tool: ToolDef,
  raw: Record<string, unknown>,
): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  const props = tool.input_schema.properties ?? {};
  const required = tool.input_schema.required ?? [];

  const missing = required.filter((k) => raw[k] === undefined || raw[k] === null || raw[k] === '');
  if (missing.length) {
    return { ok: false, error: `${tool.name}: missing required argument(s): ${missing.join(', ')}` };
  }

  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const spec = props[key];
    if (!spec) continue; // ignore extras rather than failing the call
    const expected = String(spec.type ?? '');
    const enumValues = spec.enum as unknown[] | undefined;

    let coerced = value;
    if (expected === 'integer' || expected === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        return { ok: false, error: `${tool.name}: '${key}' must be a number, got ${JSON.stringify(value)}` };
      }
      coerced = expected === 'integer' ? Math.trunc(n) : n;
    } else if (expected === 'boolean') {
      coerced = typeof value === 'boolean'
        ? value
        : ['true', '1', 'yes'].includes(String(value).toLowerCase());
    } else if (expected === 'string' && typeof value !== 'string') {
      coerced = String(value);
    }

    if (enumValues?.length && !enumValues.includes(coerced)) {
      return {
        ok: false,
        error: `${tool.name}: '${key}' must be one of ${enumValues.join(', ')} — got ${JSON.stringify(coerced)}`,
      };
    }
    args[key] = coerced;
  }
  return { ok: true, args };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

const DEFAULT_TOOL_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RESULT_CHARS = 6_000;

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly ctx: ToolContext,
    private readonly onEvent: (kind: string, data: Record<string, unknown>) => void = () => {},
  ) {}

  /**
   * Execute a hop's calls, preserving the model's ordering semantics.
   *
   * Only CONSECUTIVE reads overlap. A write is a barrier: a read the model put
   * after a write must see that write, or she will tell the owner a job is
   * still "Booked" one line after moving it to "In progress".
   */
  async executeBatch(
    calls: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  ): Promise<ToolOutcome[]> {
    const outcomes: ToolOutcome[] = [];
    let run: typeof calls = [];

    const flush = async () => {
      if (!run.length) return;
      const batch = run;
      run = [];
      if (batch.length === 1) {
        outcomes.push(await this.execute(batch[0]));
      } else {
        outcomes.push(...await Promise.all(batch.map((c) => this.execute(c))));
      }
    };

    for (const call of calls) {
      const risk = this.registry.get(call.name)?.risk ?? 'write';
      if (risk === 'read') {
        run.push(call);
        continue;
      }
      await flush();
      outcomes.push(await this.execute(call));
    }
    await flush();
    return outcomes;
  }

  async execute(
    call: { id: string; name: string; input: Record<string, unknown> },
  ): Promise<ToolOutcome> {
    const started = Date.now();
    const tool = this.registry.get(call.name);

    const fail = (content: unknown, risk: Risk = 'read'): ToolOutcome => ({
      name: call.name,
      callId: call.id,
      content: packObservation(content, DEFAULT_MAX_RESULT_CHARS),
      isError: true,
      durationMs: Date.now() - started,
      risk,
    });

    if (!tool) {
      return fail({
        error: `Unknown tool '${call.name}'.`,
        available: this.registry.names(),
      });
    }

    if (tool.allowRoles && !tool.allowRoles.includes(this.ctx.role)) {
      return fail({
        error: `'${call.name}' is not available on a ${this.ctx.role} login.`,
        denied_for_role: this.ctx.role,
      }, tool.risk);
    }

    const validated = validateArgs(tool, call.input ?? {});
    if (!validated.ok) {
      // An argument error is the model's to fix, so it goes back as an
      // observation rather than a thrown exception. It is never retried.
      return fail({ error: validated.error }, tool.risk);
    }

    try {
      const value = await withTimeout(
        () => Promise.resolve(tool.handler(validated.args, this.ctx)),
        tool.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
        `${tool.name} took longer than ${(tool.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS) / 1000}s`,
      );

      // Component 10, at the point it is cheapest: confirm a write landed
      // before she tells the owner it did.
      if (tool.verify && !looksLikeError(value)) {
        const verdict = await tool.verify(value, validated.args, this.ctx);
        if (!verdict.ok) {
          this.onEvent('verify.failed', { tool: tool.name, detail: verdict.detail });
          return fail({
            error: `The ${tool.name} call reported success but could not be confirmed: ${verdict.detail ?? 'not found on re-read'}. Do not tell the user it succeeded. Check and try again.`,
          }, tool.risk);
        }
      }

      const isError = looksLikeError(value);
      if (isError) this.onEvent('tool.error', { tool: tool.name, value: shorten(value) });

      return {
        name: call.name,
        callId: call.id,
        content: packObservation(value, tool.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS),
        isError,
        durationMs: Date.now() - started,
        risk: tool.risk,
      };
    } catch (err) {
      this.onEvent('tool.error', { tool: tool.name, error: (err as Error).message });
      // Hand it back rather than throwing: a failed lookup is something she can
      // report, and that beats the whole chat dying.
      return fail({ error: (err as Error).message }, tool.risk);
    }
  }
}

function looksLikeError(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'error' in (value as Record<string, unknown>));
}

function shorten(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 200);
  } catch {
    return String(value).slice(0, 200);
  }
}

export function withTimeout<T>(fn: () => Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new HarnessError(message, { errorClass: 'llm_recoverable' })),
      ms,
    );
    fn().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
