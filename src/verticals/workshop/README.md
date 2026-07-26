# Vertical Pack: Workshop

The first vertical for Platform OS. Everything **workshop-specific** lives here —
it must not leak into `src/core`.

Scope (ported from v2.5's proven domain):
- Vehicles register, DVI inspections, loan cars
- Parts & tyres, stock take, supplier orders
- Tyre pricing rules, roadworthy (RWC) certificates
- ANPR plate lookup, OBD2 interpretation

The **engine** for these (Supabase schema + edge functions) is reused from
`wai2much/platform-os-ver-2.5` — this pack is the product-grade UI + config layer
on top, wired for multi-tenant.
