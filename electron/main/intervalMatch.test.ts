/**
 * Self-check for matching a logged service to its intervals. Run it directly:
 *   node electron/main/intervalMatch.test.ts
 * (Node strips the types; this file imports nothing from Electron.)
 */
import assert from 'node:assert/strict'
import { matchIntervals } from './presets/serviceIntervals.ts'

const iv = (name: string, category_key: string | null) => ({ name, category_key })
const intervals = [
  iv('Oil and Filter Change', 'oil-change'),
  iv('Engine Air Filter', 'air-filter'),
  iv('Cabin Air Filter', 'cabin-filter'),
  iv('Brake Fluid', 'brake-fluid'),
  iv('Brake Inspection', 'brake-inspect'),
  iv('Coolant Flush', 'coolant'),
  iv('Tire Rotation', 'tire-rotation'),
  iv('Wiper Blades', 'wipers'),
  iv('Grease nipples', null),
]
const names = (category: string, description: string) =>
  matchIntervals(category, description, intervals).map(m => m.name)

// One visit, several jobs.
assert.deepEqual(names('Oil Change', 'Oil and filter, air filter, wipers'),
  ['Oil and Filter Change', 'Engine Air Filter', 'Wiper Blades'])

// A narrower phrase doesn't also count as the broader one inside it.
assert.deepEqual(names('Other', 'Cabin air filter'), ['Cabin Air Filter'])
assert.deepEqual(names('Other', 'Brake fluid flush'), ['Brake Fluid'])

// The description decides; the category only fills in when it names nothing.
assert.deepEqual(names('Brake Service', 'Brake fluid flush'), ['Brake Fluid'])
assert.deepEqual(names('Tyre Rotation', 'Rotated all four'), ['Tire Rotation'])
assert.deepEqual(names('Brake Service', 'Pads front'), ['Brake Inspection'])

// Intervals you added yourself match by name.
assert.deepEqual(names('Other', 'Grease nipples on the front axle'), ['Grease nipples'])

// Nothing named, nothing ticked.
assert.deepEqual(names('Other', 'Replaced number plate light'), [])
assert.deepEqual(names('', ''), [])

console.log('interval matching: ok')
