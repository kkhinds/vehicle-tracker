import { addMonths, format, parseISO } from 'date-fns'

/**
 * When insurance money actually leaves your account. A policy row holds one
 * premium and how often it's paid; the spend views need dated payments.
 *
 * The monthly chart used to add the whole premium to every month the policy
 * covered, so a $2,400 annual policy put $2,400 in all twelve bars. Counting
 * payments on the day they fall keeps every view (bars, categories, quarters,
 * years) adding up to the same money.
 */

export interface PolicyPayments {
  premium_amount: number
  payment_frequency: string
  start_date: string
  renewal_date: string | null
}

const MONTHS_BETWEEN: Record<string, number> = { monthly: 1, quarterly: 3, annually: 12 }

/** Total paid on dates from `from` to `to`, inclusive ('yyyy-MM-dd'). */
export function insurancePaidBetween(policies: PolicyPayments[], from: string, to: string): number {
  let total = 0
  for (const p of policies) {
    // Unknown frequency: one payment a year, which is what the form saves.
    const step = MONTHS_BETWEEN[p.payment_frequency] ?? 12
    const start = parseISO(p.start_date)
    // A premium is paid each period from the start, and the next one due on
    // or after renewal belongs to the next policy, not this one.
    for (let k = 0; ; k++) {
      const due = format(addMonths(start, k * step), 'yyyy-MM-dd')
      if (due > to) break
      if (k > 0 && p.renewal_date && due >= p.renewal_date) break
      if (due >= from) total += p.premium_amount
      if (!p.renewal_date) break
    }
  }
  return total
}
