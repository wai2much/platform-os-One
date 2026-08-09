import { handlePreflight, json } from '../_shared/cors.ts';
import { requireUser, serviceClient } from '../_shared/client.ts';
import { orgContextOf } from '../_shared/identity.ts';

/**
 * zellerPayments — creates a payment request (a text-to-pay style link)
 * through Zeller, the payment processor Wai has chosen to build in directly
 * rather than abstract behind a generic "provider" interface (2026-08-09
 * decision — see DESIGN.md). Mirrors how Podium sits on Stripe: one
 * processor, wired in properly, not a pluggable multi-provider layer.
 *
 * STATUS: scaffold only. Zeller's actual Payment Links API contract
 * (endpoint, auth header shape, request/response fields, webhook events)
 * hasn't been confirmed against their real developer docs yet — those sit
 * behind a Zeller Developer account. Rather than guess at a fake endpoint
 * and risk it looking done when it silently isn't (exactly the class of
 * bug this project is trying to stop repeating), this returns a clearly
 * labelled stub response until ZELLER_API_KEY is set AND the fetch call
 * below has been verified against Zeller's real reference docs.
 *
 * To go live:
 *   1. `supabase secrets set ZELLER_API_KEY=... ZELLER_API_BASE=...`
 *   2. Replace the createZellerPaymentLink() body with the real API call.
 *   3. Add a zellerWebhook function to receive payment-status callbacks
 *      (Pending -> Paid) and update whatever table ends up tracking
 *      payment requests — that table doesn't exist yet either; the
 *      Leads Funnel's "Request payment" demo currently keeps this
 *      client-side only.
 */

type PaymentRequestBody = {
  customerName?: string;
  customerPhone?: string;
  amount?: number;
  description?: string;
};

async function createZellerPaymentLink(body: PaymentRequestBody, apiKey: string) {
  // TODO: replace with the real Zeller Payment Links endpoint + payload once
  // confirmed against https://www.myzeller.com/au/developer-suite docs.
  // This shape is a reasonable guess (amount in cents, a reference, a
  // redirect/webhook URL) — NOT verified. Do not treat this as working.
  const base = Deno.env.get('ZELLER_API_BASE') || 'https://api.myzeller.com';
  const res = await fetch(`${base}/v1/payment-links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount_cents: Math.round((body.amount || 0) * 100),
      description: body.description || 'Payment request',
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Zeller API returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const svc = serviceClient();
    const ctx = await orgContextOf(user, svc);
    if (!ctx) return json({ error: 'No organization found for this account.' }, 403);

    const body = (await req.json().catch(() => ({}))) as PaymentRequestBody;
    if (!body.amount || body.amount <= 0) {
      return json({ error: 'amount must be greater than 0' }, 400);
    }

    const apiKey = Deno.env.get('ZELLER_API_KEY');
    if (!apiKey) {
      // Explicit, honest stub — never a silent fake success. The frontend
      // checks `stub: true` and falls back to its own simulated flow.
      return json({
        stub: true,
        message: 'ZELLER_API_KEY is not configured yet — no live payment link was created.',
        wouldRequest: { orgId: ctx.orgId, ...body },
      });
    }

    const link = await createZellerPaymentLink(body, apiKey);
    return json({ stub: false, link });
  } catch (err) {
    console.error('zellerPayments error:', err);
    return json({ error: 'Failed to create payment link', detail: String(err?.message || err) }, 502);
  }
});
