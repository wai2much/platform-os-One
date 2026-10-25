import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smsConfig, normalizeAuMobile, sendViaProvider, verifyInboundSecret, parseInbound, NOT_CONFIGURED } from './_smsProvider.js';

test('unconfigured without keys', () => {
  assert.equal(smsConfig({}).configured, false);
  assert.deepEqual(smsConfig({}).missing, ['LINKEDUP_API_KEY', 'LINKEDUP_SENDER']);
});
test('send refuses until configured, and never guesses an endpoint', async () => {
  assert.equal((await sendViaProvider({ to: '+61400000000', body: 'x' }, {})).error, NOT_CONFIGURED);
  const r = await sendViaProvider({ to: '+61400000000', body: 'x' }, { LINKEDUP_API_KEY: 'k', LINKEDUP_SENDER: 's' });
  assert.equal(r.ok, false);
});
test('AU mobile normalisation', () => {
  assert.equal(normalizeAuMobile('0412 345 678'), '+61412345678');
  assert.equal(normalizeAuMobile('61412345678'), '+61412345678');
  assert.equal(normalizeAuMobile('03 9999 9999'), null);
});
test('webhook secret', () => {
  const env = { LINKEDUP_WEBHOOK_SECRET: 'abc' };
  assert.equal(verifyInboundSecret({ headers: { 'x-webhook-secret': 'abc' } }, env), true);
  assert.equal(verifyInboundSecret({ headers: {}, query: { secret: 'abd' } }, env), false);
  assert.equal(verifyInboundSecret({ headers: { 'x-webhook-secret': 'abc' } }, {}), false);
});
test('inbound parse returns null rather than inventing', () => {
  assert.equal(parseInbound({ foo: 1 }), null);
  assert.deepEqual(parseInbound({ from: '0412345678', message: 'hi' }), { contact: '+61412345678', body: 'hi', our_number: null });
});
