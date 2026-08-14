-- Mercedes harness — persistence layer.
--
-- An Edge Function has no filesystem and no memory between invocations, so the
-- three things the harness needs to survive a request live in Postgres:
--
--   mercedes_memory   long-term memory, tiered (index always loaded, body on demand)
--   mercedes_runs     per-turn checkpoints, so a hop ceiling is resumable
--   mercedes_events   telemetry, one row per run
--
-- Everything is org-scoped, exactly like the rest of Slim's schema. RLS is on
-- and no policies grant client access: these tables are service-role only, and
-- the client never reads them directly.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Component 3 — memory
-- ---------------------------------------------------------------------------

create table if not exists public.mercedes_memory (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  -- Scope: 'org' is shared across everyone in the workshop, 'user' is private
  -- to one login. The owner's preferences should not leak onto a staff screen.
  scope        text not null default 'org' check (scope in ('org', 'user')),
  user_id      uuid,
  key          text not null,
  -- Tier 1: always loaded into the system prompt. Kept short on purpose.
  summary      text not null check (char_length(summary) <= 200),
  -- Tier 2: fetched only when she asks for it by key.
  body         text not null default '',
  tags         text[] not null default '{}',
  -- Memory is a HINT, not a source of truth. Confidence and last-verified let
  -- her weigh a remembered fact against what the tools say right now.
  confidence   real not null default 1.0 check (confidence between 0 and 1),
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint mercedes_memory_scope_user check (scope = 'org' or user_id is not null)
);

create unique index if not exists mercedes_memory_key_idx
  on public.mercedes_memory (org_id, scope, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

create index if not exists mercedes_memory_org_idx on public.mercedes_memory (org_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Component 7 — state / checkpoints
-- ---------------------------------------------------------------------------

create table if not exists public.mercedes_runs (
  run_id       text primary key,
  org_id       uuid not null,
  user_id      uuid,
  goal         text not null default '',
  hop          integer not null default 0,
  -- The full Anthropic-shaped conversation, so a run can be resumed exactly.
  convo        jsonb not null default '[]'::jsonb,
  stop_reason  text,
  usage        jsonb not null default '{}'::jsonb,
  tools_used   text[] not null default '{}',
  partial      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists mercedes_runs_org_idx on public.mercedes_runs (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Component 12 — telemetry
-- ---------------------------------------------------------------------------

create table if not exists public.mercedes_events (
  id           bigserial primary key,
  run_id       text not null,
  org_id       uuid not null,
  user_id      uuid,
  stop_reason  text,
  hops         integer not null default 0,
  elapsed_ms   integer not null default 0,
  usage        jsonb not null default '{}'::jsonb,
  tools_used   text[] not null default '{}',
  events       jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists mercedes_events_org_idx on public.mercedes_events (org_id, created_at desc);
create index if not exists mercedes_events_run_idx on public.mercedes_events (run_id);

-- ---------------------------------------------------------------------------
-- Lockdown: service-role only. No policies = no client access under RLS.
-- ---------------------------------------------------------------------------

alter table public.mercedes_memory enable row level security;
alter table public.mercedes_runs   enable row level security;
alter table public.mercedes_events enable row level security;

-- ---------------------------------------------------------------------------
-- Housekeeping. Transcripts and events are debugging aids, not records.
-- ---------------------------------------------------------------------------

create or replace function public.mercedes_prune(older_than interval default interval '30 days')
returns void language sql as $$
  delete from public.mercedes_runs   where created_at < now() - older_than;
  delete from public.mercedes_events where created_at < now() - older_than;
$$;
