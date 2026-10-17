import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOverdue, displayStatus, makePayment } from './invoiceMoney.js';

const PAST = '2020-01-01';
const FUTURE = '2999-01-01';
const today = '2026-07-15';

test('isOverdue needs a due date, an unpaid balance, and a date in the past', () => {
  assert.equal(isOverdue({ amount: 100, dueDate: PAST, status: 'Sent' }, today), true);
  assert.equal(isOverdue({ amount: 100, dueDate: FUTURE, status: 'Sent' }, today), false);
  assert.equal(isOverdue({ amount: 100, status: 'Sent' }, today), false); // no due date
  assert.equal(isOverdue({ amount: 100, dueDate: PAST, status: 'Paid' }, today), false); // legacy settled owes nothing
});

test('displayStatus surfaces Overdue once the due date passes', () => {
  assert.equal(displayStatus({ amount: 100, dueDate: FUTURE, status: 'Sent' }, today), 'Sent');
  assert.equal(displayStatus({ amount: 100, dueDate: PAST, status: 'Sent' }, today), 'Overdue');
});

test('a part-paid invoice past its date reads Overdue, not Part paid', () => {
  const inv = { amount: 100, dueDate: PAST, status: 'Sent', payments: [makePayment({ amount: 40, method: 'Cash' })] };
  assert.equal(displayStatus(inv, today), 'Overdue');
});

test('a settled invoice stays Paid even if the date has passed', () => {
  const inv = { amount: 100, dueDate: PAST, status: 'Sent', payments: [makePayment({ amount: 100, method: 'Cash' })] };
  assert.equal(displayStatus(inv, today), 'Paid');
});

test('invoices with no due date behave exactly as before', () => {
  assert.equal(displayStatus({ amount: 100, status: 'Sent' }, today), 'Sent');
  assert.equal(displayStatus({ amount: 100, status: 'Paid' }, today), 'Paid');
  const part = { amount: 100, status: 'Sent', payments: [makePayment({ amount: 40, method: 'Cash' })] };
  assert.equal(displayStatus(part, today), 'Part paid');
});
