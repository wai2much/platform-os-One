// Component 3 — memory.
//
// The old Mercedes had none: every conversation started cold, and anything the
// owner told her ("Vito does the alignments", "Global Meats bills monthly on
// account") had to be repeated every session.
//
// Two tiers, because an Edge Function pays for every token on every hop:
//   tier 1  the index — one line per entry, ALWAYS in the system prompt
//   tier 2  the body  — fetched by key, only when she decides it matters
//
// The rule that keeps this safe: memory is a HINT. Every entry carries a
// confidence and a last-updated date, and the persona instructs her to verify
// against the tools before acting on a remembered fact. A stale memory that
// silently overrides live data is worse than no memory at all.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type MemoryScope = 'org' | 'user';

export type MemoryEntry = {
  key: string;
  summary: string;
  body: string;
  tags: string[];
  scope: MemoryScope;
  confidence: number;
  updated_at: string;
};

export const MAX_SUMMARY_CHARS = 200;
export const MAX_BODY_CHARS = 8_000;
const MAX_INDEX_ENTRIES = 40;

export class MemoryStore {
  constructor(
    private readonly svc: SupabaseClient,
    private readonly orgId: string,
    private readonly userId: string | null,
  ) {}

  /**
   * Tier 1. Everything this org (and this user) knows, one line each.
   *
   * Capped hard: memory that grows without bound quietly eats the window and
   * pushes the actual question into the middle, which is where models read
   * worst. If it does not fit in ~40 lines, it belongs in a body.
   */
  async index(): Promise<string> {
    const { data, error } = await this.svc
      .from('mercedes_memory')
      .select('key, summary, tags, scope, confidence, updated_at')
      .eq('org_id', this.orgId)
      .or(this.scopeFilter())
      .order('updated_at', { ascending: false })
      .limit(MAX_INDEX_ENTRIES);

    if (error || !data?.length) return '';

    const lines = data.map((row: Record<string, unknown>) => {
      const date = String(row.updated_at ?? '').slice(0, 10);
      const confidence = Number(row.confidence ?? 1);
      const shaky = confidence < 0.6 ? ' (low confidence)' : '';
      const scope = row.scope === 'user' ? ' (yours)' : '';
      return `- ${row.key}${scope}: ${row.summary} [${date}${shaky}]`;
    });
    return lines.join('\n');
  }

  /**
   * Tier 2. The full note.
   *
   * Not maybeSingle(): an org-scoped and a user-scoped entry may share a key,
   * and maybeSingle() errors on two rows. User scope wins — a personal note is
   * more specific than the shop-wide one.
   */
  async read(key: string): Promise<MemoryEntry | null> {
    const { data, error } = await this.svc
      .from('mercedes_memory')
      .select('key, summary, body, tags, scope, confidence, updated_at')
      .eq('org_id', this.orgId)
      .eq('key', key.trim())
      .or(this.scopeFilter())
      .order('scope', { ascending: false }) // 'user' sorts after 'org'
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as MemoryEntry;
  }

  async write(entry: {
    key: string;
    summary: string;
    body?: string;
    tags?: string[];
    scope?: MemoryScope;
    confidence?: number;
  }): Promise<{ ok: boolean; error?: string }> {
    const key = entry.key.trim();
    if (!key) return { ok: false, error: 'key is required' };

    const summary = entry.summary.trim().replace(/\s+/g, ' ');
    if (!summary) return { ok: false, error: 'summary is required' };
    if (summary.length > MAX_SUMMARY_CHARS) {
      return {
        ok: false,
        error: `summary must be ${MAX_SUMMARY_CHARS} characters or fewer (it is loaded on every message). Put the detail in body.`,
      };
    }

    const scope: MemoryScope = entry.scope ?? 'org';
    if (scope === 'user' && !this.userId) return { ok: false, error: 'no user id for a user-scoped memory' };

    const { error } = await this.svc.from('mercedes_memory').upsert(
      {
        org_id: this.orgId,
        scope,
        user_id: scope === 'user' ? this.userId : null,
        key,
        summary,
        body: (entry.body ?? '').slice(0, MAX_BODY_CHARS),
        tags: entry.tags ?? [],
        confidence: clamp(entry.confidence ?? 1, 0, 1),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,scope,user_id,key' },
    );
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async forget(key: string): Promise<boolean> {
    const { error } = await this.svc
      .from('mercedes_memory')
      .delete()
      .eq('org_id', this.orgId)
      .eq('key', key.trim());
    return !error;
  }

  async search(query: string, limit = 10): Promise<MemoryEntry[]> {
    const safe = query.trim().replace(/[%,()]/g, ' ');
    if (!safe) return [];
    const { data, error } = await this.svc
      .from('mercedes_memory')
      .select('key, summary, body, tags, scope, confidence, updated_at')
      .eq('org_id', this.orgId)
      .or(`key.ilike.%${safe}%,summary.ilike.%${safe}%,body.ilike.%${safe}%`)
      .limit(Math.min(limit, 25));
    return error ? [] : ((data ?? []) as MemoryEntry[]);
  }

  private scopeFilter(): string {
    return this.userId
      ? `scope.eq.org,user_id.eq.${this.userId}`
      : 'scope.eq.org';
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : hi;
}

/** A store that does nothing, for when the tables have not been created yet. */
export class NullMemoryStore {
  index(): Promise<string> {
    return Promise.resolve('');
  }
  read(): Promise<MemoryEntry | null> {
    return Promise.resolve(null);
  }
  write(): Promise<{ ok: boolean; error?: string }> {
    return Promise.resolve({ ok: false, error: 'memory is not enabled on this deployment' });
  }
  forget(): Promise<boolean> {
    return Promise.resolve(false);
  }
  search(): Promise<MemoryEntry[]> {
    return Promise.resolve([]);
  }
}

export type Memory = MemoryStore | NullMemoryStore;
