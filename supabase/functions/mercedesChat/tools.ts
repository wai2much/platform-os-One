import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { Role } from './identity.ts';

// Mercedes' eyes and hands, rewritten against Slim's actual multi-tenant
// schema (supabase/schema.sql) instead of v2.5's service_job/auto_invoice/
// auto_part/employee tables — different names, different columns, every
// query scoped to the caller's org_id so one tenant can never see another's.
//
// Reads are broad. Writes are internal to the business: she can move a job
// across the floor, assign a tech, add a note, and — as of 2026-08-08, by
// Wai's explicit instruction — raise an invoice when told to. She still
// cannot touch payments (mark paid, void, take money) or contact a customer
// directly. Money movement stays a human's call; everything short of that,
// she executes on instruction, no refusal, for owner and staff alike.

export const JOB_STATUSES = ['Booked', 'In progress', 'Awaiting approval', 'Ready', 'Completed'] as const;

export const TOOLS = [
  {
    name: 'get_floor',
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
        status: { type: 'string', description: "Exact status filter: 'Booked', 'In progress', 'Awaiting approval', 'Ready', or 'Completed'." },
        limit: { type: 'integer', description: 'Max rows, default 25.' },
      },
    },
  },
  {
    name: 'get_accounts',
    description:
      'The accounts. Invoices and balances. Use for outstanding balances, overdue invoices, what has been paid. Amounts are as stored on the invoice.',
    input_schema: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: ['outstanding', 'overdue', 'paid'],
          description: "'outstanding' = Sent or On account. 'overdue' = status is Overdue.",
        },
        limit: { type: 'integer', description: 'Max rows, default 25.' },
      },
      required: ['view'],
    },
  },
  {
    name: 'find_stock',
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
  },
  {
    name: 'get_staff',
    description: 'The team: names, roles and shift status.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_customer',
    description:
      "One customer, their vehicles and their recent jobs. Search by name, phone or rego. Use before answering anything about a specific person or car.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Name, phone number, or vehicle rego.' } },
      required: ['query'],
    },
  },
  {
    name: 'get_job',
    description: 'Full detail on one job by its job number.',
    input_schema: {
      type: 'object',
      properties: { job_number: { type: 'string' } },
      required: ['job_number'],
    },
  },
  {
    name: 'update_job',
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
  },
  {
    name: 'create_invoice',
    description:
      "Raise a real invoice. Use when told to invoice a customer, bill a job, or enter an invoice into the system — do it, don't draft it. Standalone (account/fleet billing) or linked to an existing job number. Amount is GST-inclusive AUD. This creates the invoice as Sent (or On account) — it never marks something paid or takes a payment; that stays a human call.",
    input_schema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: 'Customer or account name the invoice is billed to.' },
        amount: { type: 'number', description: 'GST-inclusive total, AUD.' },
        job_number: { type: 'string', description: "Optional. Link to an existing job — its number, e.g. 'J-425'." },
        terms: { type: 'string', description: "Payment terms text, e.g. 'Due on receipt', '14 days'. Default 'Due on receipt'." },
        due_by: { type: 'string', description: "Due date as shown to the customer, e.g. 'Today', '21 Aug'. Default 'Today'." },
        on_account: { type: 'boolean', description: 'True if this bills to a standing account rather than requiring immediate payment.' },
      },
      required: ['customer', 'amount'],
    },
  },
];

const ACTIVE_EXCLUDED = ['Completed'];

export async function runTool(
  name: string,
  input: Record<string, any>,
  svc: SupabaseClient,
  orgId: string,
  role: Role = 'owner',
): Promise<unknown> {
  const limit = Math.min(Number(input?.limit) || 25, 100);

  // The prompt tells her what staff may see. This enforces it — a prompt is
  // an instruction and can be argued with; a tool that never returns the
  // number cannot. Money data is gated here, not there.
  const DENIED = { error: 'Owner-level only. Not available on a staff login.', denied_for_role: role };
  if (role === 'staff' && name === 'get_accounts') return DENIED;

  if (name === 'get_floor') {
    let q = svc
      .from('jobs')
      .select('id, customer, vehicle, tech, status, total')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const when = input?.when || 'active';
    if (when === 'active') q = q.not('status', 'in', `(${ACTIVE_EXCLUDED.join(',')})`);
    if (input?.status) q = q.eq('status', input.status);

    const { data, error } = await q;
    if (error) return { error: error.message };
    return { count: data?.length || 0, jobs: data || [] };
  }

  if (name === 'get_accounts') {
    let q = svc
      .from('invoices')
      .select('id, customer, job, amount, due_by, status, credit_hold, on_account')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const view = input?.view;
    if (view === 'overdue') q = q.eq('status', 'Overdue');
    else if (view === 'paid') q = q.eq('status', 'Paid');
    else if (view === 'outstanding') q = q.in('status', ['Sent', 'On account', 'Overdue']);

    const { data, error } = await q;
    if (error) return { error: error.message };
    const total = (data || []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
    return { count: data?.length || 0, total, invoices: data || [] };
  }

  if (name === 'find_stock') {
    const term = String(input?.query || '').trim();
    const safe = term.replace(/[%,()]/g, ' ');
    const rowLimit = Math.min(Number(input?.limit) || 20, 50);

    let tyres: any[] = [];
    {
      let q = svc.from('tyre_stock').select('brand, model, size, rating, qty, cost, sell, reorder')
        .eq('org_id', orgId).limit(rowLimit);
      if (safe) q = q.or(`brand.ilike.%${safe}%,model.ilike.%${safe}%,size.ilike.%${safe}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      tyres = (data || []).map((r: any) => ({ ...r, is_tyre: true, name: `${r.brand} ${r.model}`.trim() }));
    }

    let parts: any[] = [];
    if (!input?.tyres_only) {
      let q = svc.from('parts').select('name, size, stock, price, status')
        .eq('org_id', orgId).limit(rowLimit);
      if (safe) q = q.ilike('name', `%${safe}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      parts = (data || []).map((r: any) => ({ ...r, is_tyre: false }));
    }

    // Staff get the asking price, not the cost — same split as the accounts gate.
    const rows = [...parts, ...tyres].map((r: any) => {
      if (role === 'owner') return r;
      const { cost: _c, ...rest } = r;
      return rest;
    });

    return { count: rows.length, stock: rows };
  }

  if (name === 'get_staff') {
    const { data, error } = await svc
      .from('team_members')
      .select('name, role, status')
      .eq('org_id', orgId)
      .order('name', { ascending: true })
      .limit(100);
    if (error) return { error: error.message };
    return { count: data?.length || 0, staff: data || [] };
  }

  if (name === 'get_customer') {
    const term = String(input?.query || '').trim();
    if (!term) return { error: 'query is required' };
    const safe = term.replace(/[%,()]/g, ' ');

    const { data: customers, error } = await svc
      .from('customers')
      .select('id, name, phone, email, vehicle, last_visit, status, spend, job_history')
      .eq('org_id', orgId)
      .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
      .limit(5);
    if (error) return { error: error.message };

    if (!customers?.length) {
      const { data: byRego } = await svc
        .from('vehicles')
        .select('owner, model, rego, status')
        .eq('org_id', orgId)
        .ilike('rego', `%${safe}%`)
        .limit(5);
      if (byRego?.length) return { matched_on: 'rego', vehicles: byRego };
      return { count: 0, note: 'No customer or vehicle matches that.' };
    }

    const c = customers[0];
    const { data: vehicles } = await svc
      .from('vehicles')
      .select('model, rego, odo, last_service, next_due, status')
      .eq('org_id', orgId)
      .eq('owner', c.name)
      .limit(10);

    return {
      customer: c,
      other_matches: customers.slice(1).map((x: any) => x.name),
      vehicles: vehicles || [],
    };
  }

  if (name === 'get_job') {
    const jn = String(input?.job_number || '').trim();
    if (!jn) return { error: 'job_number is required' };
    const { data, error } = await svc
      .from('jobs')
      .select('id, customer, vehicle, tech, status, total, lines')
      .eq('org_id', orgId)
      .eq('id', jn)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { found: false, note: `No job with number ${jn}.` };
    return { found: true, job: data };
  }

  if (name === 'update_job') {
    const jn = String(input?.job_number || '').trim();
    if (!jn) return { error: 'job_number is required' };

    const { data: job, error: findErr } = await svc
      .from('jobs')
      .select('id, status, tech, notes')
      .eq('org_id', orgId)
      .eq('id', jn)
      .maybeSingle();
    if (findErr) return { error: findErr.message };
    if (!job) return { error: `No job with number ${jn}. Nothing changed.` };

    const patch: Record<string, unknown> = {};
    const changed: string[] = [];

    if (input?.status) {
      if (!JOB_STATUSES.includes(input.status)) {
        return { error: `'${input.status}' is not a real status. Valid: ${JOB_STATUSES.join(', ')}. Nothing changed.` };
      }
      patch.status = input.status;
      changed.push(`status ${job.status} -> ${input.status}`);
    }

    if (input?.tech) {
      const { data: staff } = await svc
        .from('team_members').select('name').eq('org_id', orgId).ilike('name', String(input.tech).trim());
      if (!staff?.length) {
        return { error: `No team member named '${input.tech}'. Nothing changed.` };
      }
      patch.tech = staff[0].name;
      changed.push(`tech ${job.tech || 'unassigned'} -> ${staff[0].name}`);
    }

    if (input?.note) {
      const stamp = new Date().toISOString().split('T')[0];
      const line = `[${stamp} Mercedes] ${String(input.note).trim()}`;
      patch.notes = job.notes ? `${job.notes}\n${line}` : line;
      changed.push('note added');
    }

    if (!changed.length) return { error: 'Nothing to change. Give a status, a tech, or a note.' };

    const { error: updErr } = await svc.from('jobs').update(patch).eq('id', job.id);
    if (updErr) return { error: updErr.message };
    return { updated: true, job_number: job.id, changed };
  }

  if (name === 'create_invoice') {
    const customer = String(input?.customer || '').trim();
    if (!customer) return { error: 'customer is required. Nothing created.' };

    const amount = Number(input?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: 'amount must be a positive number (GST-inclusive AUD). Nothing created.' };
    }

    // If it's billed against a job, that job has to actually exist in this org.
    // Inventing a job number on an invoice is worse than refusing to raise it.
    let jobLabel = '';
    let fromJob = false;
    const jn = String(input?.job_number || '').trim();
    if (jn) {
      const { data: job, error: jobErr } = await svc
        .from('jobs').select('id').eq('org_id', orgId).eq('id', jn).maybeSingle();
      if (jobErr) return { error: jobErr.message };
      if (!job) return { error: `No job with number ${jn} in this org. Nothing created.` };
      jobLabel = `Job #${job.id}`;
      fromJob = true;
    }

    // Next invoice number, scoped to this org. Mirrors the client's
    // nextNum(invoices, 'INV-', 1055): highest existing number wins, floor 1055,
    // zero-padded to the widest id on file (min 4).
    //
    // Two reads, because neither alone is safe. PostgREST caps a plain select at
    // ~1000 rows, and this org already carries 1,830 migrated invoices — scanning
    // "recent" alone can miss the real maximum and hand back a number that's
    // already taken. So: newest 1000 by date, plus the lexically-largest id
    // (which IS the numeric largest while ids stay the same width). Take the
    // higher of the two, then let the insert retry settle any remaining tie.
    const [recent, largest] = await Promise.all([
      svc.from('invoices').select('id').eq('org_id', orgId)
        .order('created_at', { ascending: false }).limit(1000),
      svc.from('invoices').select('id').eq('org_id', orgId)
        .order('id', { ascending: false }).limit(1),
    ]);
    if (recent.error) return { error: recent.error.message };
    if (largest.error) return { error: largest.error.message };

    let max = 1055;
    let width = 4;
    for (const row of [...(recent.data || []), ...(largest.data || [])]) {
      const digits = (String(row.id).match(/\d+/) || [])[0];
      if (!digits) continue;
      const n = parseInt(digits, 10);
      if (Number.isFinite(n) && n > max) max = n;
      if (digits.length > width) width = digits.length;
    }

    const onAccount = input?.on_account === true;
    const base = {
      org_id: orgId,
      customer,
      job: jobLabel,
      terms: String(input?.terms || '').trim() || 'Due on receipt',
      due_by: String(input?.due_by || '').trim() || 'Today',
      // Raised, not paid. She has no tool that can mark an invoice paid or void
      // one — money movement stays with a human, by design.
      status: onAccount ? 'On account' : 'Sent',
      amount,
      credit_hold: false,
      from_job: fromJob,
      on_account: onAccount,
    };

    // Insert, and walk the number up if something already holds it — covers both
    // a partial scan above and a second invoice raised at the same moment.
    let invId = '';
    let lastErr = '';
    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = `INV-${String(max + 1 + attempt).padStart(width, '0')}`;
      const { error: insErr } = await svc.from('invoices').insert({ id: candidate, ...base });
      if (!insErr) { invId = candidate; break; }
      // 23505 = unique violation. Anything else is a real failure, stop.
      if ((insErr as { code?: string }).code !== '23505') return { error: insErr.message };
      lastErr = insErr.message;
    }
    if (!invId) return { error: `Could not allocate an invoice number after 25 tries. Nothing created. (${lastErr})` };

    return {
      created: true,
      invoice_number: invId,
      customer,
      amount,
      status: base.status,
      job: jobLabel || null,
      // Xero sync happens client-side on the Invoices screen; an invoice raised
      // through Mercedes lands in Platform OS only until that's wired server-side.
      note: 'Raised in Platform OS. Not marked paid — payment is handled by a person.',
    };
  }

  return { error: `Unknown tool: ${name}` };
}
