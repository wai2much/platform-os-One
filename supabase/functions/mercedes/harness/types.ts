// Shared types for Mercedes' agent harness.
//
// Deliberately compatible with the shapes agent.ts already used, so tools.ts,
// persona.ts and identity.ts do not need to change.

export type Block = {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
};

export type ConvoMessage = { role: string; content: unknown };

export type ToolRunner = (name: string, input: Record<string, unknown>) => Promise<unknown>;

export type ToolSchema = {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  [key: string]: unknown;
};

export type StopReason =
  | 'completed'      // she settled on an answer
  | 'max_hops'       // hop ceiling
  | 'token_budget'   // token ceiling
  | 'wall_clock'     // running out of Edge Function time
  | 'guardrail'      // tripwire fired
  | 'error';         // unrecoverable

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type AgentResult = {
  // -- the original contract, unchanged --
  content: string;
  toolsUsed: string[];
  hops: number;
  stopped?: 'max_hops';

  // -- what the harness adds --
  stopReason: StopReason;
  usage: Usage;
  elapsedMs: number;
  runId: string;
  /** True when the loop ran out of room but salvaged a usable partial answer. */
  partial: boolean;
  events: HarnessEvent[];
  error?: string;
};

export type HarnessEvent = {
  kind: string;
  hop: number;
  atMs: number;
  data: Record<string, unknown>;
};

export const emptyUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

export function addUsage(into: Usage, raw: Record<string, unknown> | undefined | null): void {
  if (!raw) return;
  into.input += Number(raw.input_tokens ?? 0) || 0;
  into.output += Number(raw.output_tokens ?? 0) || 0;
  into.cacheRead += Number(raw.cache_read_input_tokens ?? 0) || 0;
  into.cacheWrite += Number(raw.cache_creation_input_tokens ?? 0) || 0;
}

export const totalTokens = (u: Usage): number => u.input + u.output + u.cacheRead + u.cacheWrite;
