// Mercedes' eyes and hands.
//
// The QUERY LOGIC here is carried over from mercedesChat/tools.ts essentially
// unchanged — it is correct, it matches Slim's real multi-tenant schema, and
// the invoice-numbering routine in particular encodes hard-won knowledge about
// PostgREST's 1000-row cap against 1,830 migrated invoices. Do not "simplify"
// create_invoice's two-read scan.
//
// What is NEW is the layer around each tool:
//   * risk         read / write / high — drives concurrency, the write cap,
//                  and whether the result gets verified
//   * allowRoles   staff never even SEES get_accounts, rather than being
//                  refused it after asking
//   * verify       a write re-reads the row before she reports success
//
// The original rule stands and is now structural: reads are broad, writes are
// internal to the business, and money movement is a human's call.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { ToolDef } from '../harness/tools.ts';
import type { Memory } from '../harness/memory.ts';

export const JOB_STATUSES = ['Booked', 'In progress', 'Awaiting approval', 'Ready', 'Completed'] as const;
const ACTIVE_EXCLUDED = ['Completed'];

export function buildTools(svc: SupabaseClient, memory: Memory): ToolDef[] {
  const lim = (v: unknown, fallback: number, cap: number) =>
    Math.min(Number(v) || fallback, cap);

  return [
    // -----------------------------------------------------------------------
    // THE FLOOR
    // -----------------------------------------------------------------------
    {
      name: 'get_floor',
      risk: 'read',
      description:
        "The floor. Jobs with their status, tech and vehicle. Use for 'what's on', 'what's stuck', 'what needs attention'. Returns the newest first.",
      input_schema: {
        type: 'object',
        properties: {
          when: {
            type: 'string',
            enum: ['active', 'all'],
            description: "'active' means anything not Completed. Default 'active'.",
          },
          status: {
            type: 'string',
            enum: [...JOB_STATUSES],
            description: 'Exact status filter.',
          },
          limit: { type: 'integer', description: 'Max rows, default 25.' },
        },
      },
      handler: async (input, ctx) => {
        let q = svc
          .from('jobs')
          .select('id, customer, vehicle, tech, status, total')
          .eq('org_id', ctx.orgId)
          .order('created_at', { ascending: false })
          .limit(lim(input.limit, 25, 100));

        if ((input.when ?? 'active') === 'active') {
          q = q.not('status', 'in', `(${ACTIVE_EXCLUDED.join(',')})`);
        }
        if (input.status) q = q.eq('status', input.status);

        const { data, error } = await q;
        if (error) return { error: error.message };
        return { count: data?.length ?? 0, jobs: data ?? [] };
      },
    },

    {
      name: 'get_job',
      risk: 'read',
      description: 'Full detail on one job by its job number.',
      input_schema: {
        type: 'object',
        properties: { job_number: { type: 'string' } },
        required: ['job_number'],
      },
      handler: async (input, ctx) => {
        const jn = String(input.job_number).trim();
        const { data, error } = await svc
          .from('jobs')
          .select('id, customer, vehicle, tech, status, total, lines')
          .eq('org_id', ctx.orgId)
          .eq('id', jn)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { found: false, note: `No job with number ${jn}.` };
        return { found: true, job: data };
      },
    },

    {
      name: 'update_job',
      risk: 'write',
      description:
        "Change a job on the floor: its status, the tech assigned, or add an internal note. Internal only — this never contacts the customer. Say what you changed after you do it.",
      input_schema: {
        type: 'object',
        properties: {
          job_number: { type: 'string' },
          status: { type: 'string', enum: [...JOB_STATUSES], description: 'New status for the job.' },
          tech: { type: 'string', description: 'Tech to assign. Must be an existing team member.' },
          note: { type: 'string', description: 'Appended to internal notes with a timestamp. Never overwrites.' },
        },
        required: ['job_number'],
      },
      handler: async (input, ctx) => {
        const jn = String(input.job_number).trim();

        const { data: job, error: findErr } = await svc
          .from('jobs')
          .select('id, status, tech, notes')
          .eq('org_id', ctx.orgId)
          .eq('id', jn)
          .maybeSingle();
        if (findErr) return { error: findErr.message };
        if (!job) return { error: `No job with number ${jn}. Nothing changed.` };

        const patch: Record<string, unknown> = {};
        const changed: string[] = [];

        if (input.status) {
          patch.status = input.status;
          changed.push(`status ${job.status} -> ${input.status}`);
        }

        if (input.tech) {
          const { data: staff } = await svc
            .from('team_members')
            .select('name')
            .eq('org_id', ctx.orgId)
            .ilike('name', String(input.tech).trim());
          if (!staff?.length) return { error: `No team member named '${input.tech}'. Nothing changed.` };
          patch.tech = staff[0].name;
          changed.push(`tech ${job.tech || 'unassigned'} -> ${staff[0].name}`);
        }

        if (input.note) {
          const stamp = new Date().toISOString().split('T')[0];
          const line = `[${stamp} Mercedes] ${String(input.note).trim()}`;
          patch.notes = job.notes ? `${job.notes}\n${line}` : line;
          changed.push('note added');
        }

        if (!changed.length) return { error: 'Nothing to change. Give a status, a tech, or a note.' };

        const { error: updErr } = await svc.from('jobs').update(patch).eq('id', job.id);
        if (updErr) return { error: updErr.message };
        return { updated: true, job_number: job.id, changed, _expect: patch };
      },
      // Read the row back. "I moved it to Ready" followed by a job still
      // sitting on Booked is the kind of wrong that costs trust immediately.
      verify: async (result, _input, ctx) => {
        const r = result as { job_number?: string; _expect?: Record<string, unknown> };
        if (!r?.job_number || !r._expect) return { ok: true };
        const { data } = await svc
          .from('jobs')
          .select('status, tech')
          .eq('org_id', ctx.orgId)
          .eq('id', r.job_number)
          .maybeSingle();
        if (!data) return { ok: false, detail: 'the job could not be re-read after the update' };
        if (r._expect.status && data.status !== r._expect.status) {
          return { ok: false, detail: `status is still '${data.status}'` };
        }
        if (r._expect.tech && data.tech !== r._expect.tech) {
          return { ok: false, detail: `tech is still '${data.tech}'` };
        }
        return { ok: true };
      },
    },

    // -----------------------------------------------------------------------
    // THE ACCOUNTS — owner only, enforced by the registry, not the prompt
    // -----------------------------------------------------------------------
    {
      name: 'get_accounts',
      risk: 'read',
      allowRoles: ['owner'],
      description:
        'The accounts. Invoices and balances. Use for outstanding balances, overdue invoices, what has been paid. Amounts are as stored on the invoice.',
      input_schema: {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: ['outstanding', 'overdue', 'paid'],
            description: "'outstanding' = Sent, On account or Overdue.",
          },
          limit: { type: 'integer', description: 'Max rows, default 25.' },
        },
        required: ['view'],
      },
      handler: async (input, ctx) => {
        let q = svc
          .from('invoices')
          .select('id, customer, job, amount, due_by, status, credit_hold, on_account')
          .eq('org_id', ctx.orgId)
          .order('created_at', { ascending: false })
          .limit(lim(input.limit, 25, 100));

        if (input.view === 'overdue') q = q.eq('status', 'Overdue');
        else if (input.view === 'paid') q = q.eq('status', 'Paid');
        else q = q.in('status', ['Sent', 'On account', 'Overdue']);

        const { data, error } = await q;
        if (error) return { error: error.message };
        const total = (data ?? []).reduce(
          (sum: number, row: { amount?: unknown }) => sum + (Number(row.amount) || 0),
          0,
        );
        return { count: data?.length ?? 0, total, invoices: data ?? [] };
      },
    },

    {
      name: 'create_invoice',
      risk: 'high',
      description:
        "Raise a real invoice. Use when told to invoice a customer, bill a job, or enter an invoice into the system — do it, don't draft it. Standalone (account/fleet billing) or linked to an existing job number. Amount is GST-inclusive AUD. This creates the invoice as Sent (or On account) — it never marks something paid or takes a payment; that stays a human call.",
      input_schema: {
        type: 'object',
        properties: {
          customer: { type: 'string', description: 'Customer or account name the invoice is billed to.' },
          amount: { type: 'number', description: 'GST-inclusive total, AUD.' },
          job_number: { type: 'string', description: "Optional. Link to an existing job — its number, e.g. 'J-425'." },
          terms: { type: 'string', description: "Payment terms text. Default 'Due on receipt'." },
          due_by: { type: 'string', description: "Due date as shown to the customer. Default 'Today'." },
          on_account: { type: 'boolean', description: 'True if this bills to a standing account.' },
        },
        required: ['customer', 'amount'],
      },
      handler: async (input, ctx) => {
        const customer = String(input.customer).trim();
        const amount = Number(input.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return { error: 'amount must be a positive number (GST-inclusive AUD). Nothing created.' };
        }

        // Billed against a job? That job has to exist in this org. Inventing a
        // job number on an invoice is worse than refusing to raise it.
        let jobLabel = '';
        let fromJob = false;
        const jn = String(input.job_number ?? '').trim();
        if (jn) {
          const { data: job, error: jobErr } = await svc
            .from('jobs').select('id').eq('org_id', ctx.orgId).eq('id', jn).maybeSingle();
          if (jobErr) return { error: jobErr.message };
          if (!job) return { error: `No job with number ${jn} in this org. Nothing created.` };
          jobLabel = `Job #${job.id}`;
          fromJob = true;
        }

        // Next invoice number, scoped to this org. Two reads, because neither
        // alone is safe: PostgREST caps a plain select at ~1000 rows and this
        // org already carries 1,830 migrated invoices, so scanning "recent"
        // alone can miss the real maximum and hand back a number already taken.
        const [recent, largest] = await Promise.all([
          svc.from('invoices').select('id').eq('org_id', ctx.orgId)
            .order('created_at', { ascending: false }).limit(1000),
          svc.from('invoices').select('id').eq('org_id', ctx.orgId)
            .order('id', { ascending: false }).limit(1),
        ]);
        if (recent.error) return { error: recent.error.message };
        if (largest.error) return { error: largest.error.message };

        let max = 1055;
        let width = 4;
        for (const row of [...(recent.data ?? []), ...(largest.data ?? [])]) {
          const digits = (String(row.id).match(/\d+/) ?? [])[0];
          if (!digits) continue;
          const n = parseInt(digits, 10);
          if (Number.isFinite(n) && n > max) max = n;
          if (digits.length > width) width = digits.length;
        }

        const onAccount = input.on_account === true;
        const base = {
          org_id: ctx.orgId,
          customer,
          job: jobLabel,
          terms: String(input.terms ?? '').trim() || 'Due on receipt',
          due_by: String(input.due_by ?? '').trim() || 'Today',
          // Raised, not paid. There is no tool that can mark an invoice paid or
          // void one — money movement stays with a human, by design.
          status: onAccount ? 'On account' : 'Sent',
          amount,
          credit_hold: false,
          from_job: fromJob,
          on_account: onAccount,
        };

        let invId = '';
        let lastErr = '';
        for (let attempt = 0; attempt < 25; attempt++) {
          const candidate = `INV-${String(max + 1 + attempt).padStart(width, '0')}`;
          const { error: insErr } = await svc.from('invoices').insert({ id: candidate, ...base });
          if (!insErr) { invId = candidate; break; }
          if ((insErr as { code?: string }).code !== '23505') return { error: insErr.message };
          lastErr = insErr.message;
        }
        if (!invId) {
          return { error: `Could not allocate an invoice number after 25 tries. Nothing created. (${lastErr})` };
        }

        return {
          created: true,
          invoice_number: invId,
          customer,
          amount,
          status: base.status,
          job: jobLabel || null,
          note: 'Raised in Platform OS. Not marked paid — payment is handled by a person.',
        };
      },
      // The highest-stakes write in the system. Confirm the row exists, and
      // that its amount is the amount she was told, before she reports a number
      // to the owner.
      verify: async (result, _input, ctx) => {
        const r = result as { invoice_number?: string; amount?: number };
        if (!r?.invoice_number) return { ok: true };
        const { data } = await svc
          .from('invoices')
          .select('id, amount, status')
          .eq('org_id', ctx.orgId)
          .eq('id', r.invoice_number)
          .maybeSingle();
        if (!data) return { ok: false, detail: `invoice ${r.invoice_number} is not in the table` };
        if (Number(data.amount) !== Number(r.amount)) {
          return { ok: false, detail: `stored amount is ${data.amount}, expected ${r.amount}` };
        }
        return { ok: true };
      },
    },

    // -----------------------------------------------------------------------
    // THE SHELF / THE TEAM / THE CUSTOMER
    // -----------------------------------------------------------------------
    {
      name: 'find_stock',
      risk: 'read',
      description:
        'Parts and tyres on the shelf, across both stock tables. Search by name, size, or brand. Returns quantity on hand and price.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free text: part name, tyre size, or brand.' },
          tyres_only: { type: 'boolean', description: 'Restrict to tyre stock.' },
          limit: { type: 'integer', description: 'Max rows, default 20.' },
        },
      },
      handler: async (input, ctx) => {
        const safe = String(input.query ?? '').trim().replace(/[%,()]/g, ' ');
        const rowLimit = lim(input.limit, 20, 50);

        let tyres: Array<Record<string, unknown>> = [];
        {
          let q = svc.from('tyre_stock')
            .select('brand, model, size, rating, qty, cost, sell, reorder')
            .eq('org_id', ctx.orgId).limit(rowLimit);
          if (safe) q = q.or(`brand.ilike.%${safe}%,model.ilike.%${safe}%,size.ilike.%${safe}%`);
          const { data, error } = await q;
          if (error) return { error: error.message };
          tyres = (data ?? []).map((r: Record<string, unknown>) => ({
            ...r,
            is_tyre: true,
            name: `${r.brand} ${r.model}`.trim(),
          }));
        }

        let parts: Array<Record<string, unknown>> = [];
        if (!input.tyres_only) {
          let q = svc.from('parts').select('name, size, stock, price, status')
            .eq('org_id', ctx.orgId).limit(rowLimit);
          if (safe) q = q.ilike('name', `%${safe}%`);
          const { data, error } = await q;
          if (error) return { error: error.message };
          parts = (data ?? []).map((r: Record<string, unknown>) => ({ ...r, is_tyre: false }));
        }

        // Staff get the asking price, not the cost — the same split as accounts.
        const rows = [...parts, ...tyres].map((r) => {
          if (ctx.role === 'owner') return r;
          const { cost: _cost, ...rest } = r;
          return rest;
        });
        return { count: rows.length, stock: rows };
      },
    },

    {
      name: 'get_staff',
      risk: 'read',
      description: 'The team: names, roles and shift status.',
      input_schema: { type: 'object', properties: {} },
      handler: async (_input, ctx) => {
        const { data, error } = await svc
          .from('team_members')
          .select('name, role, status')
          .eq('org_id', ctx.orgId)
          .order('name', { ascending: true })
          .limit(100);
        if (error) return { error: error.message };
        return { count: data?.length ?? 0, staff: data ?? [] };
      },
    },

    {
      name: 'get_customer',
      risk: 'read',
      description:
        'One customer, their vehicles and their recent jobs. Search by name, phone or rego. Use before answering anything about a specific person or car.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Name, phone number, or vehicle rego.' } },
        required: ['query'],
      },
      handler: async (input, ctx) => {
        const safe = String(input.query).trim().replace(/[%,()]/g, ' ');
        if (!safe) return { error: 'query is required' };

        const { data: customers, error } = await svc
          .from('customers')
          .select('id, name, phone, email, vehicle, last_visit, status, spend, job_history')
          .eq('org_id', ctx.orgId)
          .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
          .limit(5);
        if (error) return { error: error.message };

        if (!customers?.length) {
          const { data: byRego } = await svc
            .from('vehicles')
            .select('owner, model, rego, status')
            .eq('org_id', ctx.orgId)
            .ilike('rego', `%${safe}%`)
            .limit(5);
          if (byRego?.length) return { matched_on: 'rego', vehicles: byRego };
          return { count: 0, note: 'No customer or vehicle matches that.' };
        }

        const c = customers[0];
        const { data: vehicles } = await svc
          .from('vehicles')
          .select('model, rego, odo, last_service, next_due, status')
          .eq('org_id', ctx.orgId)
          .eq('owner', c.name)
          .limit(10);

        return {
          customer: c,
          other_matches: customers.slice(1).map((x: { name: string }) => x.name),
          vehicles: vehicles ?? [],
        };
      },
    },

    // -----------------------------------------------------------------------
    // MEMORY — new. The reason she stops asking the same question every week.
    // -----------------------------------------------------------------------
    {
      name: 'remember',
      risk: 'write',
      description:
        "Keep a note for future conversations. Use for durable facts about how this business runs — a standing arrangement, who does what, a preference the owner has stated. Not for one-off chatter and not for anything you inferred rather than were told. The summary is loaded into every future message, so keep it to one short line and put detail in body.",
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: "Short stable identifier, e.g. 'billing/global-meats'." },
          summary: { type: 'string', description: 'One line, under 200 characters. Always loaded.' },
          body: { type: 'string', description: 'Optional detail, fetched only when recalled.' },
          scope: {
            type: 'string',
            enum: ['org', 'user'],
            description: "'org' = everyone here. 'user' = just this person. Default 'org'.",
          },
          confidence: { type: 'number', description: '0 to 1. Below 0.6 is flagged as unreliable when shown.' },
        },
        required: ['key', 'summary'],
      },
      handler: async (input) => {
        const result = await memory.write({
          key: String(input.key),
          summary: String(input.summary),
          body: String(input.body ?? ''),
          scope: (input.scope as 'org' | 'user') ?? 'org',
          confidence: input.confidence === undefined ? 1 : Number(input.confidence),
        });
        return result.ok
          ? { remembered: true, key: input.key }
          : { error: result.error };
      },
    },

    {
      name: 'recall',
      risk: 'read',
      description:
        'Read one of your notes in full by its key, or search your notes by keyword. The index in your prompt only shows the one-line summaries.',
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Exact key to read in full.' },
          search: { type: 'string', description: 'Keyword search across your notes instead.' },
        },
      },
      handler: async (input) => {
        if (input.key) {
          const entry = await memory.read(String(input.key));
          return entry ?? { found: false, note: `No note under '${input.key}'.` };
        }
        if (input.search) {
          const hits = await memory.search(String(input.search));
          return { count: hits.length, notes: hits };
        }
        return { error: 'Give either a key or a search term.' };
      },
    },
  ];
}
