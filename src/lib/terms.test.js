import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueDateFrom, normalizeTerms, endOfMonthIso, termsLabel, isAccountTerm } from './terms.js';

test('due on receipt falls due the day it is raised', () => {
  assert.equal(dueDateFrom('DUE_ON_RECEIPT', '2026-07-15'), '2026-07-15');
  assert.equal(dueDateFrom('CASHONDEL', '2026-07-15'), '2026-07-15');
});

test('net terms add calendar days', () => {
  assert.equal(dueDateFrom('NET_7', '2026-07-15'), '2026-07-22');
  assert.equal(dueDateFrom('NET_30', '2026-07-15'), '2026-08-14');
  assert.equal(dueDateFrom('30DAYS', '2026-07-15'), '2026-08-14');
});

test('EOM terms count from the end of the invoice month', () => {
  assert.equal(endOfMonthIso('2026-07-15'), '2026-07-31');
  assert.equal(dueDateFrom('EOM_30', '2026-07-15'), '2026-08-30'); // 31 Jul + 30
  assert.equal(dueDateFrom('30DAYSAEOM', '2026-07-01'), '2026-08-30');
  assert.equal(dueDateFrom('60DAYSAEOM', '2026-07-15'), '2026-09-29'); // 31 Jul + 60
});

test('EOM and net handle February and the year rollover', () => {
  assert.equal(endOfMonthIso('2026-02-10'), '2026-02-28');
  assert.equal(dueDateFrom('EOM_30', '2026-02-10'), '2026-03-30');
  assert.equal(dueDateFrom('NET_30', '2026-12-20'), '2027-01-19');
});

test('no invoice date means no due date', () => {
  assert.equal(dueDateFrom('NET_30', ''), null);
  assert.equal(dueDateFrom('NET_30', null), null);
});

test('normalizeTerms maps WSS codes, labels and junk to a canonical code', () => {
  assert.equal(normalizeTerms('CASHONDEL'), 'DUE_ON_RECEIPT');
  assert.equal(normalizeTerms(''), 'DUE_ON_RECEIPT');
  assert.equal(normalizeTerms('30DAYSAEOM'), 'EOM_30');
  assert.equal(normalizeTerms('60DAYSAEOM'), 'EOM_60');
  assert.equal(normalizeTerms('Net 30'), 'NET_30');
  assert.equal(normalizeTerms('NET_14'), 'NET_14');
  assert.equal(normalizeTerms('On account'), 'NET_30');
  assert.equal(normalizeTerms('something odd'), 'DUE_ON_RECEIPT');
});

test('labels and the account-term test', () => {
  assert.equal(termsLabel('NET_30'), 'Net 30');
  assert.equal(termsLabel('bad code'), 'Due on receipt');
  assert.equal(isAccountTerm('NET_30'), true);
  assert.equal(isAccountTerm('DUE_ON_RECEIPT'), false);
});
