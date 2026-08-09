import { useMemo, useState } from 'react';
import {
  Search, Plus, X, Phone, MessageCircle, Globe, Mic, Users,
  DollarSign, Calendar, StickyNote, MoreHorizontal, ChevronDown,
} from 'lucide-react';
import { fmt } from '@/core/store';

/**
 * Leads Funnel — proof-of-concept add-on.
 *
 * Modeled on the Podium kanban board Wai showed us (New lead -> Outreach ->
 * Scheduling -> ... -> Won/Lost, 11 stages), simplified down to 7 stages
 * that map to how a tyre/mechanical shop actually works a lead end to end.
 *
 * Deliberately self-contained: state lives in this component (SAMPLE_LEADS
 * below), not in store.jsx or supabase/schema.sql. That's the point of a
 * proof-of-concept add-on per DESIGN.md -- it can be demoed, reworked, or
 * deleted without any risk to the rest of the app. Wiring it to a real
 * `leads` table is the deliberate next step once this UI earns its place.
 *
 * Source tags reuse the same source vocabulary the bookings table already
 * uses ('london' | 'internal' | 'portal' -- see supabase/schema.sql and
 * the London voice-agent notes) rather than inventing new terms, so this
 * stays consistent with how the rest of Platform OS already talks about
 * where a lead came from.
 */

const STAGES = [
  { key: 'new', label: 'New Lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'booked', label: 'Booked' },
  { key: 'inService', label: 'In Service' },
  { key: 'payment', label: 'Payment' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];
const STAGE_KEYS = STAGES.map((s) => s.key);

const SOURCES = {
  london: { label: 'London (voice agent)', short: 'London', icon: Mic, tint: 'bg-accent/15 text-accent' },
  internal: { label: 'Staff picked up', short: 'Staff', icon: Users, tint: 'bg-primary/15 text-primary' },
  portal: { label: 'Booking portal', short: 'Portal', icon: Globe, tint: 'bg-muted text-muted-foreground' },
};

// Fictional demo data -- shaped like a one-time Podium export (name, phone,
// source, stage, tag, value, assignee, last activity) but not real customer
// data. Real leads land here once this is wired to a `leads` table.
const SAMPLE_LEADS = [
  { id: 'l1', name: 'Priya Nair', phone: '0411 222 333', source: 'london', stage: 'new', value: 0, tag: 'Tyres', assignee: null, lastActivity: '2h ago' },
  { id: 'l2', name: '0403 771 902', phone: '0403 771 902', source: 'london', stage: 'new', value: 0, tag: null, assignee: null, lastActivity: '5h ago' },
  { id: 'l3', name: 'Marco Bellini', phone: '0422 918 004', source: 'internal', stage: 'new', value: 0, tag: 'Service', assignee: 'Sam', lastActivity: '1d ago' },
  { id: 'l4', name: 'Grace Whitfield', phone: '0455 300 118', source: 'portal', stage: 'contacted', value: 0, tag: 'Wheel align', assignee: 'Wai', lastActivity: '1d ago' },
  { id: 'l5', name: 'Denny Osei', phone: '0433 087 221', source: 'london', stage: 'contacted', value: 0, tag: null, assignee: null, lastActivity: '2d ago' },
  { id: 'l6', name: 'HC Auto Repairs', phone: '0398 442 190', source: 'internal', stage: 'booked', value: 0, tag: 'Fleet', assignee: 'Anthony', lastActivity: '2d ago' },
  { id: 'l7', name: 'Renee Kowalski', phone: '0412 655 470', source: 'london', stage: 'booked', value: 0, tag: 'Tyres', assignee: 'Sam', lastActivity: '3d ago' },
  { id: 'l8', name: 'Terry Falzon', phone: '0466 210 837', source: 'internal', stage: 'inService', value: 0, tag: 'Brakes', assignee: 'Vito', lastActivity: '4h ago' },
  { id: 'l9', name: 'Aisha Rahman', phone: '0421 998 340', source: 'portal', stage: 'payment', value: 386, tag: 'Job #50912', assignee: 'Anthony', lastActivity: '1h ago' },
  { id: 'l10', name: 'Long Vu', phone: '0403 774 314', source: 'internal', stage: 'payment', value: 1386, tag: 'Job #50903', assignee: 'Anthony', lastActivity: '3d ago' },
  { id: 'l11', name: 'Vikki Sweeney', phone: '0407 348 694', source: 'london', stage: 'won', value: 550, tag: 'Membership', assignee: 'Wai', lastActivity: '2d ago' },
  { id: 'l12', name: 'Ange Colosimo', phone: '0412 946 380', source: 'internal', stage: 'won', value: 310, tag: null, assignee: 'Sam', lastActivity: '2w ago' },
  { id: 'l13', name: 'Chris Markovski', phone: '0409 029 643', source: 'portal', stage: 'lost', value: 0, tag: 'Went elsewhere', assignee: null, lastActivity: '8mo ago' },
];

// Activity feed entries. `kind: 'payment'` entries are what the payment
// request feature (below) appends to -- rendered inline in this same feed,
// same as calls/texts/automations, rather than as a separate payments
// screen. That's the one thing worth taking straight from Podium's actual
// payment docs (ours doesn't have the feature turned on to see it live):
// a payment request shows up as a message in the thread, not a new tab.
const SAMPLE_ACTIVITY = {
  l9: [
    { id: 'a1', kind: 'payment', status: 'paid', amount: 386, icon: DollarSign, label: 'Payment request sent -- $386.00', when: '1h ago' },
    { id: 'a2', kind: 'call', icon: Phone, label: 'Call completed -- 0:47', when: 'Yesterday' },
    { id: 'a3', kind: 'source', icon: Mic, label: 'Booked by London (voice agent)', when: '3 days ago' },
  ],
  l1: [
    { id: 'a4', kind: 'source', icon: Mic, label: 'New lead from London -- asked about tyre pricing', when: '2h ago' },
  ],
};

const uid = () => Math.random().toString(36).slice(2, 10);

function initialsOf(name) {
  return (name || '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function SourceBadge({ source }) {
  const s = SOURCES[source] ?? SOURCES.internal;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.tint}`} title={s.label}>
      <Icon size={11} strokeWidth={2.4} />
      {s.short}
    </span>
  );
}

function LeadCard({ lead, onOpen, onDragStart, onMove }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', lead.id); onDragStart(lead.id); }}
      onClick={() => onOpen(lead.id)}
      className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-card hover:shadow-pop transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-foreground">{lead.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{lead.phone}</div>
        </div>
        <div className="shrink-0">
          <select
            value={lead.stage}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onMove(lead.id, e.target.value)}
            className="rounded-md border border-border bg-background px-1 py-0.5 text-[10px] text-muted-foreground"
            aria-label={`Move ${lead.name} to a different stage`}
          >
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SourceBadge source={lead.source} />
        {lead.tag && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{lead.tag}</span>
        )}
        {lead.value > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{fmt(lead.value)}</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        {lead.assignee
          ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{initialsOf(lead.assignee)}</span>
          : <span className="text-[10px] text-muted-foreground">Unassigned</span>}
        <span className="text-[10px] text-muted-foreground">{lead.lastActivity}</span>
      </div>
    </div>
  );
}

function StageColumn({ stage, leads, onOpen, onDragStart, onDrop, onMove }) {
  const total = leads.reduce((sum, l) => sum + (l.value || 0), 0);
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(stage.key); }}
      className="flex w-64 shrink-0 flex-col rounded-lg bg-muted/40 p-2.5"
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">{stage.label}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{leads.length}</span>
        </div>
      </div>
      {total > 0 && <div className="px-1 pb-2 text-[11px] font-medium text-muted-foreground">{fmt(total)}</div>}
      <div className="flex flex-col gap-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={onOpen} onDragStart={onDragStart} onMove={onMove} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
            No leads here
          </div>
        )}
      </div>
    </div>
  );
}

function NewLeadModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', phone: '', source: 'internal' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSave = form.name.trim() || form.phone.trim();

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div onClick={(e) => e.stopPropagation()} className="w-[360px] rounded-lg bg-card p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-lg text-foreground">New lead</span>
          <button onClick={onClose} className="text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-2.5">
          <input autoFocus value={form.name} onChange={set('name')} placeholder="Name (or leave blank for phone-only)"
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none" />
          <input value={form.phone} onChange={set('phone')} placeholder="Phone"
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none" />
          <select value={form.source} onChange={set('source')}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none">
            {Object.entries(SOURCES).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
          </select>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            disabled={!canSave}
            onClick={() => canSave && onCreate(form)}
            className="rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-40"
          >
            Add lead
          </button>
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Podium's real payment request is an itemised amount that sends as a
// text-to-pay link inline in the customer's message thread. This models
// that shape -- items + running total -- but nothing here moves real
// money. It appends a "Pending" entry to the activity feed on send; see
// the "Mark as paid (demo)" button on that entry for the rest of the flow.
function PaymentRequestModal({ lead, onClose, onSend }) {
  const [items, setItems] = useState([{ desc: '', price: '' }]);
  const total = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0);

  const setItem = (i, key) => (e) => {
    const v = e.target.value;
    setItems((its) => its.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)));
  };
  const addItem = () => setItems((its) => [...its, { desc: '', price: '' }]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div onClick={(e) => e.stopPropagation()} className="w-[400px] rounded-lg bg-card p-5 shadow-pop">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-lg text-foreground">Request payment</span>
          <button onClick={onClose} className="text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="mb-4 text-[11px] text-muted-foreground">
          Sends a text-to-pay link to <span className="font-semibold text-foreground">{lead.name}</span> ({lead.phone}) -- demo only, no real charge.
        </div>

        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <input value={it.desc} onChange={setItem(i, 'desc')} placeholder="Item / description"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none" />
              <input value={it.price} onChange={setItem(i, 'price')} placeholder="0.00" inputMode="decimal"
                className="w-24 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none" />
            </div>
          ))}
        </div>
        <button onClick={addItem} className="mt-2 text-[12px] font-semibold text-primary">+ Add another item</button>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-[12px] font-semibold text-muted-foreground">Total</span>
          <span className="text-[15px] font-bold text-foreground">{fmt(total)}</span>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            disabled={total <= 0}
            onClick={() => total > 0 && onSend({ items: items.filter((it) => it.desc || it.price), total })}
            className="rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-40"
          >
            Send payment request
          </button>
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadDetail({ lead, activity, onClose, onMove, onRequestPayment, onMarkPaid }) {
  const stageIndex = STAGE_KEYS.indexOf(lead.stage);
  const [showPayment, setShowPayment] = useState(false);
  const s = SOURCES[lead.source] ?? SOURCES.internal;

  return (
    <div className="flex w-80 shrink-0 flex-col gap-4 border-l border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {initialsOf(lead.name)}
          </div>
          <div>
            <div className="text-[14px] font-bold text-foreground">{lead.name}</div>
            <div className="text-[11px] text-muted-foreground">{lead.phone}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground"><X size={16} /></button>
      </div>

      <div className="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
        Came in via <span className="font-semibold text-foreground">{s.label}</span>.
        {activity[0] ? ` Most recent: ${activity[0].label.toLowerCase()}.` : ' No AI summary yet -- this is a proof-of-concept panel.'}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowPayment(true)}
          title="Request payment"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
        >
          <DollarSign size={15} />
        </button>
        {[Phone, Calendar, StickyNote, MoreHorizontal].map((Icon, i) => (
          <button key={i} className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground">
            <Icon size={15} />
          </button>
        ))}
      </div>

      <div>
        <select
          value={lead.stage}
          onChange={(e) => onMove(lead.id, e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] font-medium text-foreground"
        >
          {STAGES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
        </select>
        <div className="mt-2 flex gap-1">
          {STAGES.map((st, i) => (
            <div key={st.key} className={`h-1.5 flex-1 rounded-full ${i <= stageIndex ? (lead.stage === 'lost' ? 'bg-red-500' : 'bg-primary') : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Activity</div>
        <div className="flex flex-col gap-3">
          {activity.length === 0 && <div className="text-[11px] text-muted-foreground">No activity logged yet.</div>}
          {activity.map((a) => (
            <div key={a.id ?? a.label} className="flex items-start gap-2">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <a.icon size={12} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-foreground">{a.label}</span>
                  {a.kind === 'payment' && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${a.status === 'paid' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {a.status}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">{a.when}</div>
                {a.kind === 'payment' && a.status === 'pending' && (
                  <button
                    onClick={() => onMarkPaid(lead.id, a.id)}
                    className="mt-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Mark as paid (demo)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showPayment && (
        <PaymentRequestModal
          lead={lead}
          onClose={() => setShowPayment(false)}
          onSend={(request) => { onRequestPayment(lead.id, request); setShowPayment(false); }}
        />
      )}
    </div>
  );
}

export function LeadsFunnel() {
  const [leads, setLeads] = useState(SAMPLE_LEADS);
  const [activityByLead, setActivityByLead] = useState(SAMPLE_ACTIVITY);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [dragId, setDragId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => l.name.toLowerCase().includes(q) || l.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')));
  }, [leads, query]);

  const byStage = (key) => filtered.filter((l) => l.stage === key);
  const sourceCounts = useMemo(() => {
    const counts = { london: 0, internal: 0, portal: 0 };
    leads.forEach((l) => { counts[l.source] = (counts[l.source] ?? 0) + 1; });
    return counts;
  }, [leads]);

  const move = (id, stage) => setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l)));

  // Advance-only stage nudge: a payment event pulls a lead further down the
  // funnel automatically, but never pushes it backward (e.g. a lead a staff
  // member already marked Won won't get yanked back to Payment).
  const advanceStage = (id, stageKey) => setLeads((ls) => ls.map((l) => {
    if (l.id !== id) return l;
    const cur = STAGE_KEYS.indexOf(l.stage);
    const next = STAGE_KEYS.indexOf(stageKey);
    return next > cur ? { ...l, stage: stageKey } : l;
  }));

  // Request payment: models Podium's text-to-pay pattern -- the request
  // lands as a Pending entry in the lead's own activity feed (same feed as
  // calls/texts), not a separate payments screen. No real charge happens.
  const requestPayment = (leadId, { total }) => {
    const id = uid();
    setActivityByLead((a) => ({
      ...a,
      [leadId]: [{ id, kind: 'payment', status: 'pending', amount: total, icon: DollarSign, label: `Payment request sent -- ${fmt(total)}`, when: 'Just now' }, ...(a[leadId] ?? [])],
    }));
    advanceStage(leadId, 'payment');
  };

  // Mark paid (demo): flips the request to Paid, appends the automated
  // receipt line Podium's docs describe, and reflects the amount on the
  // lead's card/column totals -- so the funnel's $ figures stay honest.
  const markPaid = (leadId, activityId) => {
    setActivityByLead((a) => ({
      ...a,
      [leadId]: (a[leadId] ?? []).map((entry) => (entry.id === activityId ? { ...entry, status: 'paid' } : entry)),
    }));
    const paidEntry = (activityByLead[leadId] ?? []).find((e) => e.id === activityId);
    if (paidEntry) {
      setActivityByLead((a) => ({
        ...a,
        [leadId]: [{ id: uid(), kind: 'receipt', icon: StickyNote, label: `Receipt sent automatically -- ${fmt(paidEntry.amount)}`, when: 'Just now' }, ...(a[leadId] ?? [])],
      }));
      setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, value: paidEntry.amount } : l)));
    }
    advanceStage(leadId, 'won');
  };

  const openLead = leads.find((l) => l.id === openId);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        {/* Proof-of-concept banner -- honest about what this is until it's wired to real data. */}
        <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          Proof of concept -- leads below are sample data to show the layout, not your live pipeline. Reloading the page resets them. "Request payment" simulates a text-to-pay request; no real charge is made.
        </div>

        {/* Where leads come in -- London (voice agent) vs staff picking up the phone
            directly vs the booking portal. Same source vocabulary the bookings
            table already uses. */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(SOURCES).map(([key, s]) => (
            <span key={key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${s.tint}`}>
              <s.icon size={13} strokeWidth={2.4} />
              {s.short} · {sourceCounts[key] ?? 0}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-[13px] text-foreground outline-none"
            />
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-bold text-primary-foreground"
          >
            <Plus size={14} /> New lead
          </button>
        </div>

        <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage}
              leads={byStage(stage.key)}
              onOpen={setOpenId}
              onDragStart={setDragId}
              onDrop={(stageKey) => dragId && move(dragId, stageKey)}
              onMove={move}
            />
          ))}
        </div>
      </div>

      {openLead && (
        <LeadDetail
          lead={openLead}
          activity={activityByLead[openLead.id] ?? []}
          onClose={() => setOpenId(null)}
          onMove={move}
          onRequestPayment={requestPayment}
          onMarkPaid={markPaid}
        />
      )}

      {showNew && (
        <NewLeadModal
          onClose={() => setShowNew(false)}
          onCreate={(form) => {
            setLeads((ls) => [...ls, {
              id: 'l' + (ls.length + 1) + '-' + Date.now(),
              name: form.name.trim() || form.phone,
              phone: form.phone,
              source: form.source,
              stage: 'new',
              value: 0,
              tag: null,
              assignee: null,
              lastActivity: 'Just now',
            }]);
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}
