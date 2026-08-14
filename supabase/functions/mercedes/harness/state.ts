// Component 7 — state management.
//
// The failure this fixes is concrete. The old loop, on hitting MAX_HOPS,
// returned a 504 and threw away everything: the tool calls it had already made,
// the invoice it may already have raised, the answer it was two hops from
// giving. The user saw "Mercedes kept looking things up" and had no way to
// continue except to start over — which risks doing the writes twice.
//
// Here every hop is checkpointed to Postgres. Running out of hops becomes a
// resumable pause instead of a dead end, and the write log survives to tell
// the next turn what has already been done.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { ConvoMessage, StopReason, Usage } from './types.ts';

export type Checkpoint = {
  runId: string;
  orgId: string;
  userId: string | null;
  goal: string;
  hop: number;
  convo: ConvoMessage[];
  usage: Usage;
  toolsUsed: string[];
  stopReason?: StopReason;
  partial?: boolean;
};

export class Checkpointer {
  constructor(private readonly svc: SupabaseClient) {}

  /**
   * Never throws, and safe to call without awaiting.
   *
   * A checkpoint is insurance, not the product. Awaiting a DB round trip on
   * every hop would add latency to the thing already racing a platform
   * timeout, and a failed checkpoint must never fail the reply — an unhandled
   * rejection here would take the whole invocation down with it.
   */
  async save(cp: Checkpoint): Promise<void> {
    try {
      const { error } = await this.svc
        .from('mercedes_runs')
        .upsert({
          run_id: cp.runId,
          org_id: cp.orgId,
          user_id: cp.userId,
          goal: cp.goal.slice(0, 2_000),
          hop: cp.hop,
          convo: cp.convo,
          usage: cp.usage,
          tools_used: cp.toolsUsed,
          stop_reason: cp.stopReason ?? null,
          partial: cp.partial ?? false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'run_id' });
      if (error) console.error('mercedes checkpoint failed:', error.message);
    } catch (err) {
      console.error('mercedes checkpoint threw:', (err as Error).message);
    }
  }

  async load(runId: string, orgId: string): Promise<Checkpoint | null> {
    const { data, error } = await this.svc
      .from('mercedes_runs')
      .select('run_id, org_id, user_id, goal, hop, convo, usage, tools_used, stop_reason, partial')
      .eq('run_id', runId)
      .eq('org_id', orgId) // never resume across tenants
      .maybeSingle();
    if (error || !data) return null;

    return {
      runId: data.run_id,
      orgId: data.org_id,
      userId: data.user_id,
      goal: data.goal ?? '',
      hop: data.hop ?? 0,
      convo: (data.convo ?? []) as ConvoMessage[],
      usage: (data.usage ?? {}) as Usage,
      toolsUsed: data.tools_used ?? [],
      stopReason: data.stop_reason ?? undefined,
      partial: data.partial ?? false,
    };
  }

  /**
   * What this org's Mercedes has already CHANGED in the recent past.
   *
   * Read at the start of a turn and put in front of her, so a resumed or
   * repeated request cannot quietly raise the same invoice twice. This is the
   * one piece of run state that is not merely diagnostic.
   */
  async recentWrites(orgId: string, sinceMinutes = 30, limit = 5): Promise<string[]> {
    const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
    const { data, error } = await this.svc
      .from('mercedes_runs')
      .select('tools_used, goal, updated_at')
      .eq('org_id', orgId)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error || !data?.length) return [];

    const out: string[] = [];
    for (const row of data as Array<Record<string, unknown>>) {
      const used = (row.tools_used ?? []) as string[];
      const writes = used.filter((t) => WRITE_TOOL_NAMES.has(t));
      if (!writes.length) continue;
      const when = String(row.updated_at ?? '').slice(11, 16);
      out.push(`${when} — ${writes.join(', ')} (asked: "${String(row.goal ?? '').slice(0, 80)}")`);
    }
    return out;
  }
}

export const WRITE_TOOL_NAMES = new Set(['update_job', 'create_invoice']);

/** No-op checkpointer for deployments without the harness tables. */
export class NullCheckpointer {
  save(): Promise<void> {
    return Promise.resolve();
  }
  load(): Promise<Checkpoint | null> {
    return Promise.resolve(null);
  }
  recentWrites(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

export type State = Checkpointer | NullCheckpointer;

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}
