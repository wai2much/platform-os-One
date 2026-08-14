// Mercedes v2 — the harnessed agent.
//
// Deploy as its own Edge Function (`mercedes`), NOT over the top of
// `mercedesChat`. The HTTP contract is deliberately identical, so cutting over
// is one endpoint string in Mercedes.jsx and cutting back is the same edit:
//
//   POST { messages: [{ from: 'user'|'bot', text }] }
//     -> { content, tools_used, run_id, stop_reason, partial, usage }
//
// The extra response fields are additive; the existing client ignores them.
//
// Secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
//          SUPABASE_SERVICE_ROLE_KEY.
// Optional: MERCEDES_MODEL, MERCEDES_MAX_HOPS, MERCEDES_WALL_CLOCK_MS,
//           MERCEDES_MEMORY ('off' to disable memory + checkpoints).

import { requireUser, serviceClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

import { runAgent } from './harness/loop.ts';
import { ToolRegistry } from './harness/tools.ts';
import { EventBus } from './harness/telemetry.ts';
import {
  escalationSentinel,
  GuardrailRunner,
  injectionSentinel,
  loopBreaker,
  secretRedactor,
  writeRateCap,
} from './harness/guardrails.ts';
import { MemoryStore, NullMemoryStore } from './harness/memory.ts';
import { Checkpointer, newRunId, NullCheckpointer } from './harness/state.ts';

import { buildSystemPrompt, toAnthropicMessages } from './mercedes/persona.ts';
import { buildTools } from './mercedes/tools.ts';
import { identityBlock, orgContextOf } from './mercedes/identity.ts';

const MODEL = Deno.env.get('MERCEDES_MODEL') ?? 'claude-opus-4-8';
const MAX_HOPS = Number(Deno.env.get('MERCEDES_MAX_HOPS') ?? 10);
const WALL_CLOCK_MS = Number(Deno.env.get('MERCEDES_WALL_CLOCK_MS') ?? 110_000);
const MEMORY_ENABLED = (Deno.env.get('MERCEDES_MEMORY') ?? 'on') !== 'off';
const MAX_TOKENS_PER_CALL = 2_048;
/** A single turn should never make more than this many writes to live data. */
const MAX_WRITES_PER_TURN = 3;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const runId = newRunId();

  try {
    const user = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json({
        error: 'ANTHROPIC_API_KEY is not set. Add it in Supabase → Edge Functions → Secrets.',
      }, 500);
    }

    const body = await req.json().catch(() => ({}));
    // Slim's Mercedes.jsx stores { from: 'user'|'bot', text } — normalise to
    // the { role, content } shape the Anthropic API expects.
    const rawMessages = Array.isArray(body.messages)
      ? body.messages.map((m: Record<string, unknown>) => ({
        role: m?.from === 'user' ? 'user' : m?.from === 'bot' ? 'assistant' : m?.role,
        content: m?.text ?? m?.content,
      }))
      : [];
    const messages = toAnthropicMessages(rawMessages);
    if (!messages.length) return json({ error: 'No messages provided' }, 400);

    const svc = serviceClient();
    const ctx = await orgContextOf(user, svc);
    if (!ctx) return json({ error: 'No organization found for this account.' }, 403);

    // -- persistence (degrades to no-ops if sql/harness.sql has not been run) --
    const memory = MEMORY_ENABLED ? new MemoryStore(svc, ctx.orgId, user.id) : new NullMemoryStore();
    const checkpointer = MEMORY_ENABLED ? new Checkpointer(svc) : new NullCheckpointer();

    const registry = new ToolRegistry(buildTools(svc, memory));
    const toolContext = { orgId: ctx.orgId, userId: user.id, role: ctx.role };

    // Two reads before the loop starts, in parallel: what she remembers, and
    // what she has already changed recently. The second is what stops a
    // double-invoice when someone asks twice.
    const [memoryIndex, recentWrites] = await Promise.all([
      memory.index().catch(() => ''),
      checkpointer.recentWrites(ctx.orgId).catch(() => [] as string[]),
    ]);

    const system = buildSystemPrompt({
      identity: identityBlock(user, ctx),
      org: { name: ctx.orgName, vertical: ctx.vertical },
      memoryIndex,
      recentWrites,
      toolNames: registry.schemas(ctx.role).map((t) => t.name),
    });

    const guardrails = new GuardrailRunner([
      injectionSentinel,
      escalationSentinel(ctx.role),
      loopBreaker(3),
      writeRateCap(MAX_WRITES_PER_TURN, (name) => registry.isWrite(name)),
      secretRedactor,
    ]);

    const bus = new EventBus();

    // Input stage runs on the latest user message only — the history has
    // already been through it on previous turns.
    const latest = messages[messages.length - 1];
    try {
      guardrails.run('input', String(latest.content ?? ''), { runId, role: ctx.role });
    } catch (err) {
      bus.emit('guardrail.trip', { stage: 'input', reason: (err as Error).message });
      await flushEvents(svc, runId, ctx.orgId, user.id, bus, 'guardrail');
      // Answer in her voice rather than returning a raw refusal object.
      return json({
        content: ctx.role === 'owner'
          ? "That reads like someone trying to talk me out of my own instructions. I'll skip it. Ask me straight and I'll help."
          : "That's not something I'll act on. The login sets what you can see, not the message. Ask me about the floor, jobs, customers or stock and I'm all yours.",
        tools_used: [],
        run_id: runId,
        stop_reason: 'guardrail',
        partial: false,
      });
    }

    const result = await runAgent({
      apiKey,
      model: MODEL,
      system,
      messages,
      registry,
      toolContext,
      runId,
      bus,
      guardrails,
      maxTokensPerCall: MAX_TOKENS_PER_CALL,
      budgets: { maxHops: MAX_HOPS, maxWallClockMs: WALL_CLOCK_MS },
      onCheckpoint: (convo, hop, toolsUsed) => {
        checkpointer.save({
          runId,
          orgId: ctx.orgId,
          userId: user.id,
          goal: String(latest.content ?? ''),
          hop,
          convo,
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          toolsUsed,
        });
      },
    });

    // Output stage: redact before anything reaches a chat bubble.
    let content = guardrails.runText('output', result.content, { runId });
    if (content.length > 10_000) content = content.slice(0, 9_997) + '...';

    await Promise.all([
      checkpointer.save({
        runId,
        orgId: ctx.orgId,
        userId: user.id,
        goal: String(latest.content ?? ''),
        hop: result.hops,
        convo: [],
        usage: result.usage,
        toolsUsed: result.toolsUsed,
        stopReason: result.stopReason,
        partial: result.partial,
      }),
      flushEvents(svc, runId, ctx.orgId, user.id, bus, result.stopReason, result),
    ]);

    // Note the deliberate 200 even on a budget stop. The old function returned
    // 504 with no reply; here there is always something true to show, and the
    // client should render it rather than throw.
    if (!content) {
      return json({
        error: 'Mercedes could not produce a reply. Nothing was changed.',
        run_id: runId,
      }, 502);
    }

    return json({
      content,
      tools_used: result.toolsUsed,
      run_id: runId,
      stop_reason: result.stopReason,
      partial: result.partial,
      usage: result.usage,
    });
  } catch (error) {
    console.error('mercedes error:', (error as Error).message);
    return json({ error: (error as Error).message, run_id: runId }, 500);
  }
});

async function flushEvents(
  svc: ReturnType<typeof serviceClient>,
  runId: string,
  orgId: string,
  userId: string,
  bus: EventBus,
  stopReason: string,
  result?: { hops: number; usage: unknown; toolsUsed: string[] },
): Promise<void> {
  await bus.flush(async (events) => {
    await svc.from('mercedes_events').insert({
      run_id: runId,
      org_id: orgId,
      user_id: userId,
      stop_reason: stopReason,
      hops: result?.hops ?? 0,
      elapsed_ms: bus.elapsedMs(),
      usage: result?.usage ?? {},
      tools_used: result?.toolsUsed ?? [],
      events,
    });
  });
}
