# Platform OS (Slim)

A **multi-vertical business OS**, SaaS. Clean product build on the Front-of-House
design language (warm cream / terracotta / sage, Caprasimo + Figtree).

## Why this exists
Platform OS **v2.5** (`wai2much/platform-os-ver-2.5`) runs TyrePlus Thomastown and
is the proven **engine** — but its UI is single-tenant and hard to re-theme. Rather
than rebuild that live system, **Slim** is a parallel, product-grade front end:
- **v2.5** stays live for the shop and is the reference customer ("it's real").
- **Slim** is what we sell — multi-tenant, clean design, reusing v2.5's backend
  (Supabase schema + edge functions) and domain logic as the engine.

## Architecture
- `src/core/` — generic business OS. **Never assumes a vertical.** Customers, jobs,
  invoicing/GST, comms, assistant, scheduling, team, accounts, settings, billing.
- `src/verticals/<name>/` — a **pack** that layers vertical-specific screens/logic
  on the core. `workshop` is Pack #1 (vehicles, inspections, parts, stock, RWC…).
- A tenant picks a vertical → its pack switches on. The core is identical for all.

## Status
Scaffold. Design system + app shell + Dashboard (sample data) stand. Next: wire the
first core screen to real data, then multi-tenancy + auth + billing.

## Run
```
npm install
npm run dev
```
