/**
 * Spotting spans that can't be real.
 *
 * Economy is measured between full tanks. If a fill-up goes unlogged, the next
 * span covers distance that fuel paid for but the log never saw, so the figure
 * comes out far better than the vehicle can actually manage — the case that
 * sent a D-Max to 21.4 km/L on a 10 km/L history.
 *
 * The comparison is against the median of the vehicle's own spans, not the
 * mean: one wild span drags a mean up far enough to excuse itself, while the
 * median barely moves. Spans already marked `missed_fills` carry no figure and
 * take no part in either.
 */

/** How far above the median a span has to sit before it stops being believable. */
export const SUSPECT_FACTOR = 1.5

/** Below this many measured spans there's no history to judge against. */
export const MIN_SAMPLE = 3

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface SpanRow {
  id: number
  consumption: number | null
  missed_fills: number
}

/**
 * Ids of full-tank rows whose economy reads too well to be true. Returns an
 * empty set until there are enough spans to have an opinion.
 */
export function suspectSpans(rows: SpanRow[]): Set<number> {
  const measured = rows.filter(r => r.missed_fills !== 1 && r.consumption != null && r.consumption > 0)
  if (measured.length < MIN_SAMPLE) return new Set()

  const mid = median(measured.map(r => r.consumption as number))
  if (mid === null || mid <= 0) return new Set()

  const ceiling = mid * SUSPECT_FACTOR
  return new Set(measured.filter(r => (r.consumption as number) > ceiling).map(r => r.id))
}
