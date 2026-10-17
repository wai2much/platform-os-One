/**
 * Payment terms — one place that turns a terms code into a real due date.
 *
 * Slim used to carry `terms` as a free-text label ('Due on receipt') and
 * `dueBy` as free text ('Today'), so nothing could ever tell whether an
 * invoice was actually late. This gives terms a small, closed set of codes,
 * each of which knows how to compute a due date from the invoice date. The
 * same mapping is mirrored in supabase/add-account-terms.sql so a backfill in
 * the database agrees with the app.
 *
 * EOM ("after end of month") terms are how trade accounts usually run and how
 * Workshop Software's "30 Days AEOM" / "60 Days AEOM" behave: the clock starts
 * at the last day of the invoice's month, not the invoice date.
 */

export const TERMS = [
  { code: 'DUE_ON_RECEIPT', label: 'Due on receipt', net: 0, eom: false },
  { code: 'NET_7', label: 'Net 7', net: 7, eom: false },
  { code: 'NET_14', label: 'Net 14', net: 14, eom: false },
  { code: 'NET_30', label: 'Net 30', net: 30, eom: false },
  { code: 'EOM_30', label: '30 days (end of month)', net: 30, eom: true },
  { code: 'EOM_60', label: '60 days (end of month)', net: 60, eom: true },
];

export const DEFAULT_TERMS = 'DUE_ON_RECEIPT';
export const DEFAULT_ACCOUNT_TERMS = 'NET_30';

const BY_CODE = Object.fromEntries(TERMS.map((t) => [t.code, t]));

export const termsLabel = (code) => (BY_CODE[code] || BY_CODE[DEFAULT_TERMS]).label;

/** Account terms = anything other than paying on the spot. */
export const isAccountTerm = (code) => !!BY_CODE[code] && code !== 'DUE_ON_RECEIPT';

// A Workshop Software export code, an old free-text label, or a canonical code,
// all resolve to one canonical code. Unknown input is treated as due on
// receipt rather than guessed — the safe default for money.
const ALIASES = {
  '': 'DUE_ON_RECEIPT',
  'CASHONDEL': 'DUE_ON_RECEIPT',
  'CASH ON DELIVERY': 'DUE_ON_RECEIPT',
  'DUE ON RECEIPT': 'DUE_ON_RECEIPT',
  'COD': 'DUE_ON_RECEIPT',
  'CASH': 'DUE_ON_RECEIPT',
  '7DAYS': 'NET_7', '7 DAYS': 'NET_7', 'NET 7': 'NET_7',
  '14DAYS': 'NET_14', '14 DAYS': 'NET_14', 'NET 14': 'NET_14',
  '30DAYS': 'NET_30', '30 DAYS': 'NET_30', 'NET 30': 'NET_30',
  'ON ACCOUNT': 'NET_30',
  '30DAYSAEOM': 'EOM_30', '30 DAYS AEOM': 'EOM_30',
  '60DAYSAEOM': 'EOM_60', '60 DAYS AEOM': 'EOM_60',
};

export function normalizeTerms(input) {
  if (input == null) return DEFAULT_TERMS;
  const raw = String(input).trim();
  if (!raw) return DEFAULT_TERMS;
  const up = raw.toUpperCase();
  if (BY_CODE[up]) return up; // already a canonical code
  return ALIASES[up] || DEFAULT_TERMS;
}

// --- date helpers: 'YYYY-MM-DD' in and out, computed in UTC so the result
// never shifts by a day with the machine's timezone -------------------------
function parseIso(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
const toIso = (dt) => dt.toISOString().slice(0, 10);

export function endOfMonthIso(iso) {
  const dt = parseIso(iso);
  return toIso(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)));
}

export function addDaysIso(iso, days) {
  const dt = parseIso(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIso(dt);
}

/**
 * The date an invoice dated `invoiceDateIso` falls due under `termsInput`.
 * Returns null if there's no invoice date to count from.
 */
export function dueDateFrom(termsInput, invoiceDateIso) {
  if (!invoiceDateIso) return null;
  const t = BY_CODE[normalizeTerms(termsInput)];
  const base = t.eom ? endOfMonthIso(invoiceDateIso) : String(invoiceDateIso).slice(0, 10);
  return t.net ? addDaysIso(base, t.net) : base;
}
