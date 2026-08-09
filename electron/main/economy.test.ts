/**
 * Self-check for the suspicious-span rule. Run it directly:
 *   node electron/main/economy.test.ts
 * (Node strips the types; this file imports nothing from Electron.)
 */
import assert from 'node:assert/strict'
import { median, suspectSpans, SUSPECT_FACTOR, type SpanRow } from './economy.ts'

const row = (id: number, consumption: number | null, missed = 0): SpanRow =>
  ({ id, consumption, missed_fills: missed })

// median
assert.equal(median([]), null)
assert.equal(median([5]), 5)
assert.equal(median([9, 1, 5]), 5)
assert.equal(median([1, 2, 3, 4]), 2.5)

// Not enough history to have an opinion.
assert.deepEqual(suspectSpans([row(1, 10), row(2, 22)]), new Set())

// The real case: a D-Max that does ~10 km/L, and one tank that says 21.4.
const dmax = [row(1, 10.02), row(2, 9.77), row(3, 10.48), row(4, 21.43)]
assert.deepEqual(suspectSpans(dmax), new Set([4]))

// The reason it's a median and not a mean: a bad span drags the mean up and
// raises the bar it has to clear. Here the mean is 12.9 (threshold 19.4) while
// the median holds at 10.25 (threshold 15.4) — so a 16 km/L span, still absurd
// for this truck, is caught by one rule and waved through by the other.
const values = dmax.map(r => r.consumption as number)
const mean = values.reduce((s, v) => s + v, 0) / values.length
assert.equal(median(values), 10.25)
assert.ok(16 > (median(values) as number) * SUSPECT_FACTOR, 'median catches a 16 km/L span')
assert.ok(16 < mean * SUSPECT_FACTOR, 'the mean would have let that same span through')

// Honest variation is left alone.
assert.deepEqual(suspectSpans([row(1, 10), row(2, 11.5), row(3, 9), row(4, 12.8)]), new Set())

// Already marked: carries no figure, takes no part, never flagged again.
assert.deepEqual(
  suspectSpans([row(1, 10.02), row(2, 9.77), row(3, 10.48), row(4, null, 1)]),
  new Set(),
)

// A marked row with a stale figure still can't poison the median or be flagged.
assert.deepEqual(
  suspectSpans([row(1, 10), row(2, 10), row(3, 10), row(4, 99, 1)]),
  new Set(),
)

// Partial fills and unmeasured spans carry null and are simply skipped.
assert.deepEqual(suspectSpans([row(1, null), row(2, null), row(3, null)]), new Set())

console.log('economy: all checks passed')
