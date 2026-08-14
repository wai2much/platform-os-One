# Mercedes v2 — the harnessed agent

A ground-up rewrite of Slim's `mercedesChat` Edge Function, built on a proper
agent harness. Her voice, loyalty rules and anti-hallucination protocol are
carried over **verbatim** — that persona is the product. What is new is
everything around the model.

Deno/TypeScript. Deploys as its own Supabase Edge Function. 25 tests, no
network required.

---

## The cutover plan

**Do not overwrite `mercedesChat`.** Deploy this alongside it:

```
supabase/functions/
  mercedesChat/     ← stays exactly as it is, live, untouched
  mercedes/         ← this. new function, new URL
  _shared/          ← unchanged, shared by both
```

The HTTP contract is deliberately identical, so cutover and rollback are the
same one-line edit in `Mercedes.jsx`:

```js
// before
supabase.functions.invoke('mercedesChat', { body: { messages } })
// after
supabase.functions.invoke('mercedes',     { body: { messages } })
```

Response adds `run_id`, `stop_reason`, `partial` and `usage` alongside the
existing `content` and `tools_used`. The current client ignores extra fields,
so nothing breaks either way.

**Steps:**

1. Run `sql/harness.sql` in the Supabase SQL editor (three tables, service-role
   only, safe to re-run).
2. Copy this folder to `supabase/functions/mercedes/`.
3. `supabase functions deploy mercedes`
4. Point one test account at it. Watch `mercedes_events`.
5. Flip `Mercedes.jsx`. Keep `mercedesChat` deployed for a fortnight.
6. Delete `mercedesChat` once you have not needed it.

Memory and checkpoints degrade gracefully: set `MERCEDES_MEMORY=off`, or just
skip step 1, and she runs without them rather than failing.

---

## What actually changes for the user

| Before | After |
|---|---|
| A 429/529 from Anthropic → the chat dies with a 500 | Retried with backoff, honouring `Retry-After` |
| Hits 8 hops → **504, no reply**, work discarded | Tools removed, one final call, honest partial answer |
| Slow call → function held open until the platform kills it | Abort timeout tracking the remaining budget |
| Every `tool_result` up to 20,000 chars, forever, re-billed each hop | Right-sized at the source, stale ones masked, history compacted |
| Blunt `slice(0, 20000)` → invalid JSON ending mid-token | Rows dropped, valid JSON, with a "narrow the query" note |
| Starts cold every conversation | Two-tier memory she writes and reads herself |
| Says "invoice raised" whether or not it landed | Re-reads the row and refuses to claim success if it can't confirm |
| Nothing stops a repeated identical call | Loop breaker at 3, write cap at 3 per turn |
| `console.error` | A typed event per decision, one row per run in `mercedes_events` |

---

## The twelve components

| # | Component | File | Notes |
|---|---|---|---|
| 1 | Orchestration loop | `harness/loop.ts` | 7 steps, layered termination, always ends with an answer |
| 2 | Tools | `harness/tools.ts` | Risk levels, arg validation, timeouts, ordering barriers |
| 3 | Memory | `harness/memory.ts` | Tier 1 index always loaded, tier 2 body on demand |
| 4 | Context management | `harness/context.ts` | Right-size → mask → compact |
| 5 | Prompt construction | `mercedes/persona.ts` | Priority stack; identity and write log at the top |
| 6 | Output parsing | `harness/model.ts` | Native tool calling, prompt caching preserved |
| 7 | State | `harness/state.ts` | Per-hop checkpoints, recent-write log |
| 8 | Error handling | `harness/errors.ts` | Four classes; only transient retries |
| 9 | Guardrails | `harness/guardrails.ts` | Input/tool/output stages, tripwires |
| 10 | Verification | `mercedes/tools.ts` `verify` | Post-write re-read |
| 11 | Subagents | — | **Deliberately omitted**; see below |
| 12 | Telemetry | `harness/telemetry.ts` | Buffered events, one flush |

---

## Three decisions worth knowing about

**No subagents.** An Edge Function is request-scoped and racing a timeout;
spawning a second agent loop inside one spends the budget that should go to
answering. If Mercedes ever needs delegation, it belongs in a background worker
or on the Phoenix droplet, not here.

**Memory is a hint, never truth.** Every entry carries a date and a confidence,
and the prompt tells her live data always wins. A stale memory that silently
overrides the database is worse than no memory at all.

**The write log is loaded before the loop starts.** `recentWrites()` puts the
last half hour of `update_job` / `create_invoice` calls at the *top* of her
prompt. That is what stops a second invoice when someone asks twice — the
single most expensive mistake this agent can make.

---

## Safety, unchanged in principle and stronger in practice

The existing design already enforced role access inside the tool rather than
the prompt. That is kept, and extended: a staff login no longer sees
`get_accounts` in its tool list at all, so there is nothing to argue about.
On top of that:

- `escalationSentinel` catches "actually I'm the owner" and logs it
- `writeRateCap` refuses a fourth write to live data in one turn
- `secretRedactor` strips key-shaped strings from the reply
- `loopBreaker` halts an agent repeating itself
- money movement remains impossible — there is still no tool that can mark an
  invoice paid, void one, or take a payment

---

## Config

| Env var | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | required |
| `MERCEDES_MODEL` | `claude-opus-4-8` | |
| `MERCEDES_MAX_HOPS` | `10` | was 8 |
| `MERCEDES_WALL_CLOCK_MS` | `110000` | keep under the platform limit |
| `MERCEDES_MEMORY` | `on` | `off` disables memory + checkpoints |

---

## Tests

```bash
deno test tests/          # 25 passed
deno check index.ts
deno lint harness/ mercedes/ index.ts
```

They pin the behaviour that is easy to regress: a 529 is retried and a 401 is
not; running out of hops still answers; a read placed after a write sees the
write; errors survive masking; compaction never orphans a `tool_result` from
its `tool_use` (the API rejects that outright); truncation leaves valid JSON;
staff never see an owner-only schema; an unconfirmed write is not reported as
success.
