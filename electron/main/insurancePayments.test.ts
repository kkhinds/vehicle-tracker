/**
 * Self-check for dating insurance payments. Run it directly:
 *   node electron/main/insurancePayments.test.ts
 * (Node strips the types; this file imports nothing from Electron.)
 */
import assert from 'node:assert/strict'
import { insurancePaidBetween, type PolicyPayments } from './insurancePayments.ts'

const annual: PolicyPayments = {
  premium_amount: 2400, payment_frequency: 'annually',
  start_date: '2026-03-15', renewal_date: '2027-03-15',
}

// An annual premium lands once, in the month it's paid.
assert.equal(insurancePaidBetween([annual], '2026-03-01', '2026-03-31'), 2400)
assert.equal(insurancePaidBetween([annual], '2026-04-01', '2026-04-30'), 0)
assert.equal(insurancePaidBetween([annual], '2027-02-01', '2027-02-28'), 0)
// Renewal day belongs to the next policy row.
assert.equal(insurancePaidBetween([annual], '2027-03-01', '2027-03-31'), 0)
// Twelve months across the term add up to one premium, not twelve.
assert.equal(insurancePaidBetween([annual], '2026-03-01', '2027-02-28'), 2400)

// Monthly payments fall every month until renewal.
const monthly: PolicyPayments = { ...annual, premium_amount: 200, payment_frequency: 'monthly' }
assert.equal(insurancePaidBetween([monthly], '2026-05-01', '2026-05-31'), 200)
assert.equal(insurancePaidBetween([monthly], '2026-03-01', '2027-03-31'), 2400)

// Quarterly.
const quarterly: PolicyPayments = { ...annual, premium_amount: 600, payment_frequency: 'quarterly' }
assert.equal(insurancePaidBetween([quarterly], '2026-06-01', '2026-06-30'), 600)
assert.equal(insurancePaidBetween([quarterly], '2026-07-01', '2026-08-31'), 0)

// Several policies add.
assert.equal(insurancePaidBetween([annual, monthly], '2026-03-01', '2026-03-31'), 2600)

console.log('insurance payments: ok')
