import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { Role } from './identity.ts';

// Mercedes' eyes and hands, rewritten against Slim's actual multi-tenant
// schema (supabase/schema.sql) instead of v2.5's service_job/auto_invoice/
// auto_part/employee tables — different names, different columns, every
// query scoped to the caller's org_id so one tenant can never see another's.
//
// Reads are broad. Writes are internal and reversible only: she can move a
// job across the floor, assign a tech, add a note. She cannot touch invoices,
// stock counts, or contact a customer. Those are outward-facing or hard to
// undo, and a model that can be talked into one is a model that will be.

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

  return { error: `Unknown tool: ${name}` };
}
