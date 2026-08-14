// Component 1 — the orchestration loop.
//
// Still a while loop. That is the point: the intelligence belongs in the model,
// and the harness only manages turns. What changed is everything the loop now
// manages around it — budgets, context, guardrails, checkpoints, telemetry —
// and, above all, how it ENDS.
//
// The old loop had one bad ending: run out of hops, return nothing, 504. This
// one always tries to hand back something true. Out of hops, out of time, out
// of tokens, or halted by a guardrail — it asks for a closing answer with the
// tools taken away, and if even that fails it reports what it did and stops.

import {
  type ContextConfig,
  conversationTokens,
  DEFAULT_CONTEXT,
  manageContext,
} from './context.ts';
import { classify, GuardrailTripped, HarnessError } from './errors.ts';
import { GuardrailRunner } from './guardrails.ts';
import { callModel } from './model.ts';
import { EventBus } from './telemetry.ts';
import { type ToolContext, ToolExecutor, ToolRegistry } from './tools.ts';
import {
  addUsage,
  type AgentResult,
  type Block,
  type ConvoMessage,
  emptyUsage,
  type StopReason,
  totalTokens,
} from './types.ts';

export type Budgets = {
  maxHops: number;
  maxTokens: number;
  /** Hard wall for the whole run. Keep it under the platform's own limit. */
  maxWallClockMs: number;
  /** Reserve enough time to still compose a closing answer. */
  closingReserveMs: number;
};

export const DEFAULT_BUDGETS: Budgets = {
  maxHops: 10,
  maxTokens: 250_000,
  maxWallClockMs: 110_000,
  closingReserveMs: 20_000,
};

export type RunOptions = {
  apiKey: string;
  model: string;
  system: string;
  messages: ConvoMessage[];
  registry: ToolRegistry;
  toolContext: ToolContext;
  budgets?: Partial<Budgets>;
  context?: Partial<ContextConfig>;
  guardrails?: GuardrailRunner;
  bus?: EventBus;
  runId: string;
  maxTokensPerCall?: number;
  onCheckpoint?: (convo: ConvoMessage[], hop: number, toolsUsed: string[]) => void;
  fetchImpl?: typeof fetch;
};

export async function runAgent(opts: RunOptions): Promise<AgentResult> {
  const budgets = { ...DEFAULT_BUDGETS, ...opts.budgets };
  const contextConfig = { ...DEFAULT_CONTEXT, ...opts.context };
  const bus = opts.bus ?? new EventBus();
  const guardrails = opts.guardrails ?? new GuardrailRunner();
  const startedAt = Date.now();

  const remainingMs = () => budgets.maxWallClockMs - (Date.now() - startedAt);

  let convo: ConvoMessage[] = [...opts.messages];
  const toolsUsed: string[] = [];
  const usage = emptyUsage();
  let lastText = '';

  const executor = new ToolExecutor(
    opts.registry,
    opts.toolContext,
    (kind, data) => bus.emit(kind, data),
  );

  bus.emit('run.start', {
    runId: opts.runId,
    model: opts.model,
    tools: opts.registry.schemas(opts.toolContext.role).length,
    role: opts.toolContext.role,
    messages: convo.length,
  });

  const finish = (
    stopReason: StopReason,
    content: string,
    hop: number,
    extra: { partial?: boolean; error?: string } = {},
  ): AgentResult => {
    bus.emit('run.end', {
      stopReason,
      hops: hop,
      tokens: totalTokens(usage),
      elapsedMs: bus.elapsedMs(),
      toolsUsed,
      partial: extra.partial ?? false,
    });
    return {
      content,
      toolsUsed,
      hops: hop,
      stopped: stopReason === 'max_hops' ? 'max_hops' : undefined,
      stopReason,
      usage,
      elapsedMs: Date.now() - startedAt,
      runId: opts.runId,
      partial: extra.partial ?? false,
      events: bus.events,
      error: extra.error,
    };
  };

  let hop = 0;
  try {
    for (;;) {
      // -- layered termination, checked BEFORE spending a hop ---------------
      const halt = checkBudgets(hop, usage, remainingMs(), budgets);
      if (halt) {
        bus.emit('budget.exceeded', { reason: halt, hop, tokens: totalTokens(usage) });
        const closing = await closingAnswer(opts, convo, halt, remainingMs, bus);
        return finish(halt, closing || lastText || fallbackText(halt, toolsUsed), hop, {
          partial: true,
        });
      }

      hop++;
      bus.setHop(hop);

      // -- step 1: context management (before assembly, not after) ----------
      const managed = manageContext(convo, opts.system, hop, contextConfig);
      convo = managed.messages;
      if (managed.compacted || managed.masked) {
        bus.emit('context.compact', {
          compacted: managed.compacted,
          masked: managed.masked,
          tokensBefore: managed.tokensBefore,
          tokensAfter: managed.tokensAfter,
          saved: managed.tokensBefore - managed.tokensAfter,
        });
      }

      // -- step 2: inference -------------------------------------------------
      const response = await callModel({
        apiKey: opts.apiKey,
        model: opts.model,
        system: opts.system,
        tools: opts.registry.schemas(opts.toolContext.role),
        messages: convo,
        maxTokens: opts.maxTokensPerCall ?? 2048,
        remainingMs,
        fetchImpl: opts.fetchImpl,
        onRetry: (attempt, err, delayMs) =>
          bus.emit('model.retry', { attempt, delayMs, error: (err as Error).message }),
      });
      addUsage(usage, response.usage);

      const blocks = response.content as Block[];
      const text = blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
        .trim();
      if (text) lastText = text;

      bus.emit('model.response', {
        stopReason: response.stop_reason,
        textChars: text.length,
        toolCalls: blocks.filter((b) => b.type === 'tool_use').length,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
      });

      // -- step 3: output classification -------------------------------------
      if (response.stop_reason !== 'tool_use') {
        return finish('completed', text, hop);
      }

      convo.push({ role: 'assistant', content: blocks });

      const calls = blocks
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({
          id: String(b.id ?? ''),
          name: String(b.name ?? ''),
          input: (b.input ?? {}) as Record<string, unknown>,
        }));

      // -- step 4: tool-stage guardrails, on the ARGUMENTS, before execution --
      for (const call of calls) {
        bus.emit('tool.call', { name: call.name, input: call.input });
        guardrails.run('tool', { name: call.name, ...call.input }, { hop, runId: opts.runId });
      }

      // -- step 5: execution and result packaging ----------------------------
      const outcomes = await executor.executeBatch(calls);
      for (const outcome of outcomes) {
        toolsUsed.push(outcome.name);
        bus.emit('tool.result', {
          name: outcome.name,
          error: outcome.isError,
          chars: outcome.content.length,
          ms: outcome.durationMs,
        });
      }

      // -- step 6: context update --------------------------------------------
      convo.push({
        role: 'user',
        content: outcomes.map((o) => ({
          type: 'tool_result',
          tool_use_id: o.callId,
          content: o.content,
          is_error: o.isError,
          // Read by the masker to decide what has gone stale.
          _hop: hop,
        })),
      });

      opts.onCheckpoint?.(convo, hop, toolsUsed);
      // -- step 7: loop ------------------------------------------------------
    }
  } catch (err) {
    if (err instanceof GuardrailTripped) {
      bus.emit('guardrail.trip', { guardrail: err.guardrail, stage: err.stage, reason: err.message });
      const closing = await closingAnswer(opts, convo, 'guardrail', remainingMs, bus);
      return finish(
        'guardrail',
        closing || lastText ||
          'I stopped myself there — I was going round in circles and did not want to keep changing things. Ask me again more specifically and I will have another go.',
        hop,
        { partial: true, error: err.message },
      );
    }

    const errorClass = classify(err);
    const message = err instanceof HarnessError
      ? err.message
      : (err as Error)?.message ?? String(err);
    bus.emit('error', { errorClass, message });

    // A user-fixable failure (bad key, no org) is worth stating plainly. An
    // unexpected one gets a short honest line, not a stack trace in a chat bubble.
    const content = errorClass === 'user_fixable'
      ? message
      : lastText ||
        'Something went wrong on my end and I could not finish that. Nothing was changed. Try again in a moment.';
    return finish('error', content, hop, { partial: Boolean(lastText), error: message });
  }
}

function checkBudgets(
  hop: number,
  usage: ReturnType<typeof emptyUsage>,
  remainingMs: number,
  budgets: Budgets,
): StopReason | null {
  if (hop >= budgets.maxHops) return 'max_hops';
  if (totalTokens(usage) >= budgets.maxTokens) return 'token_budget';
  if (remainingMs <= budgets.closingReserveMs) return 'wall_clock';
  return null;
}

/**
 * The closing answer.
 *
 * This is the single biggest behavioural difference from the old loop. Running
 * out of room used to mean a 504 and no reply. Here we take the tools away and
 * ask one final time for the best answer available from what has already been
 * gathered — which is nearly always something useful, because by definition she
 * has just made eight or ten lookups.
 */
async function closingAnswer(
  opts: RunOptions,
  convo: ConvoMessage[],
  reason: StopReason,
  remainingMs: () => number,
  bus: EventBus,
): Promise<string> {
  if (remainingMs() < 4_000) return '';

  const nudge = reason === 'guardrail'
    ? 'Stop using tools now. Something in that sequence looked wrong and I halted it. Tell the user plainly what you did establish, what you did NOT do, and what you would need from them to continue.'
    : 'Stop using tools now — you have run out of room to keep looking things up. Answer with what you already have. Be explicit about what you checked and what remains unverified. Do not invent anything you did not see.';

  try {
    const response = await callModel({
      apiKey: opts.apiKey,
      model: opts.model,
      system: opts.system,
      tools: [], // the point: she cannot ask for one more lookup
      messages: [...convo, { role: 'user', content: nudge }],
      maxTokens: 1_024,
      remainingMs,
      fetchImpl: opts.fetchImpl,
    });
    const text = (response.content as Block[])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    bus.emit('closing.answer', { reason, chars: text.length });
    return text;
  } catch (err) {
    bus.emit('closing.failed', { reason, error: (err as Error).message });
    return '';
  }
}

function fallbackText(reason: StopReason, toolsUsed: string[]): string {
  const looked = toolsUsed.length
    ? ` I did get as far as: ${[...new Set(toolsUsed)].join(', ')}.`
    : '';
  if (reason === 'wall_clock') {
    return `That one took me too long to finish.${looked} Ask me for a narrower slice of it and I will be quicker.`;
  }
  if (reason === 'token_budget') {
    return `That question pulled in more than I can hold at once.${looked} Try narrowing it — one customer, or one day.`;
  }
  return `I kept looking things up and did not settle.${looked} Ask me something more specific and I will get there.`;
}

export { conversationTokens };
