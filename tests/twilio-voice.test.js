import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { computeTwilioSignature, isValidTwilioSignature } from '../api/twilio/_twilio.js';
import { buildXaiSipUri } from '../api/twilio/voice.js';

test('signature matches Twilio algorithm (url + sorted key/value, HMAC-SHA1 base64)', () => {
  const url = 'https://example.com/api/twilio/voice';
  const params = { To: '+61300000000', CallSid: 'CA1', From: '+61400000000' };
  const expected = crypto.createHmac('sha1', 'tok').update(url + 'CallSidCA1From+61400000000To+61300000000').digest('base64');
  assert.equal(computeTwilioSignature('tok', url, params), expected);
  assert.ok(isValidTwilioSignature('tok', expected, url, params));
  assert.ok(!isValidTwilioSignature('tok', expected, url, { ...params, To: 'x' }));
  assert.ok(!isValidTwilioSignature('', expected, url, params));
});

test('xAI SIP URI', () => {
  assert.equal(buildXaiSipUri('+61291234567'), 'sip:+61291234567@sip.voice.x.ai;transport=tls');
});
