# Platform OS Slim — Design & Engineering Standards

Why this file exists: an audit in August 2026 surfaced a handful of shortcuts
that were fine for a fast solo build but would look bad — or cost real time —
once this product is handed to another developer, a partner, or a buyer.
This file is the standard going forward, so those shortcuts don't get
repeated. Update it whenever a decision like this gets made; don't let it
go stale.

## 1. Styling: one system, not two

**Decision:** Tailwind utility classes are the system of record for all new
code from here on. Inline `style={{}}` is reserved only for values that are
genuinely computed at runtime (e.g. a progress-bar width from an API). It is
never used for static colors, spacing, radius, or fonts — those get a
Tailwind class, or a small named class in the stylesheet if Tailwind doesn't
have a utility for it.

**Rule:** never put `className` and `style` on the same element to control
the same kind of property. (`className="origami-card-in" style={{ width:
'100%', maxWidth: 400 }}` in Login.jsx is the anti-pattern — pick one system
per element.)

**Existing debt:** as of Aug 2026, ~1,340 inline-style blocks vs. ~688
classNames across `src/`. Worst offenders: JobCard.jsx, HR.jsx,
Dashboard.jsx, Accounts.jsx. This is not being mass-rewritten now — too
risky without test coverage first (see §3). Policy is boy-scout rule: when a
component is already being touched for a real feature or bugfix, convert
the styles being touched to Tailwind. No dedicated rewrite pass until there
is a safety net to catch regressions.

## 2. Error handling: fail loud, never silent

**Decision:** every network/async call that can fail must surface something
to the user — a message, a toast, a changed state. Never leave a loading
state ("Thinking…", a spinner) with no timeout and no catch path.

This is exactly the bug found in Mercedes' chat: an expired session causes a
correct 401 from the backend, but the frontend has no error handling for a
failed request, so it just hangs on "Thinking…" forever with zero feedback.
Backend was right; frontend silently swallowing the failure was the bug.

Also add a top-level React error boundary so one component's crash doesn't
white-screen the entire app.

## 3. Tests: nothing that touches money or auth ships without one

Current state: zero automated tests anywhere in the repo. Before handing
this to another developer or a buyer, at minimum need: a test framework
installed (Vitest fits the existing Vite setup), and coverage on invoicing
math, RLS-sensitive queries, and Mercedes' role-based tool permissions
(staff vs. owner).

## 4. CI/CD must match what's actually in the repo

No unedited boilerplate GitHub Actions workflows. Found and flagged:
`deno.yml` runs `deno lint`/`deno test` against the whole repo, but only
`supabase/functions/` is actually Deno; `npm-publish-github-packages.yml`
would try to `npm publish` a package marked `"private": true`. Either fix
the scope or delete them — a workflow that doesn't apply to the project is
worse than no workflow, because it normalizes ignoring CI failures.

## 5. Multi-tenancy & security patterns to KEEP doing

These are working well — writing them down so nobody "simplifies" them away
under time pressure later:

- Every table's RLS policy is scoped through `memberships`
  (`org_id in (select org_id from memberships where user_id = auth.uid())`)
  — never trust a client-supplied `org_id`.
- Service-role-only tables (e.g. `xero_tokens`) get RLS enabled with zero
  policies — a deliberate lockdown, not an oversight. Keep doing this for
  any future table holding third-party tokens/secrets.
- Mercedes' tool permissions are gated server-side — `orgContextOf` resolves
  the user's real role from the `memberships` table, never from client
  input. Staff logins are denied `get_accounts` and `create_invoice`. Any
  new tool added to Mercedes must go through this same server-side gate.
- Secrets split: `VITE_`-prefixed env vars are client-safe by design;
  anything server-only must never get that prefix. Keep `.env.example` as
  the documented source of truth for this split.

## 6. Data integrity: live vs. historical stays separated

Keep the `migrated` boolean split (`liveInvoices` vs. `historicalInvoices`
in `store.jsx`) for any future data import. Never let live financial
reporting read from migrated/historical rows — an old system's payment
state can't be trusted the way freshly-entered data can.

## 7. Pre-sale / due-diligence checklist

Before this goes in front of a buyer or a serious partner, this list should
be clean:

- [ ] Test coverage on money-handling and auth-gated code
- [ ] React error boundary in place
- [ ] Styling consistency pass, at minimum on demo-facing screens
- [ ] CI workflows reflect the real stack (or are removed)
- [ ] Staff-invite flow exists (Anthony/Vito access is currently manual/deferred)
- [ ] No stray real/test data sitting in production (e.g. test invoices)
- [ ] Telephony (3CX/London) confirmed live end-to-end, not just configured

---
*Created 2026-08-09, following a full codebase audit. Add to this file as
new standards get decided — don't let it drift out of date with what the
code actually does.*
