import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatCurrency, formatEconomy, economyLabel } from '@/lib/utils'
import type { DashboardSummary, ExpenseSummary } from '@/types'

interface StatsProps {
  summary: DashboardSummary | null
  currency: string
  distanceUnit: string
  economyUnit: 'distance' | 'l_per_100km' | 'mpg'
}

/**
 * Charts are drawn as plain SVG/divs rather than pulled from a chart library —
 * the shapes here are simple, and it keeps the series colours on the design's
 * luminance ramp. Accent stays reserved for "something is due".
 */
export default function Stats({ summary, currency, distanceUnit, economyUnit }: StatsProps) {
  const [exp, setExp] = useState<ExpenseSummary | null>(null)

  useEffect(() => { window.api.expenses.getSummary().then(setExp) }, [])

  const maxMonth = useMemo(
    () => Math.max(1, ...(exp?.monthlyTrend ?? []).map(m => m.total)),
    [exp]
  )
  const months = (exp?.monthlyTrend ?? []).slice(-6)

  async function exportCsv() {
    try {
      const path = await window.api.expenses.exportCsv()
      toast.success(`Exported to ${path}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (!exp) return <p style={{ color: 'var(--dim)', fontSize: 13 }}>Loading…</p>

  const econ = formatEconomy(summary?.avgConsumption, distanceUnit, economyUnit)
  const total = exp.byCategory.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="dl-stats-grid">
      <div className="dl-panelbox">
        <h3>MONTHLY SPEND — LAST 6</h3>
        <div
          className="dl-bars"
          role="img"
          aria-label={months.map(m => `${m.label} ${formatCurrency(m.total, currency)}`).join(', ')}
        >
          {months.map(m => (
            <div className="dl-bar" key={m.month}>
              <div className="dl-col" style={{ height: `${Math.max(2, (m.total / maxMonth) * 100)}%` }}>
                <div className="f" style={{ height: `${m.total ? (m.fuel / m.total) * 100 : 0}%` }} />
                <div className="m" style={{ height: `${m.total ? ((m.total - m.fuel) / m.total) * 100 : 0}%` }} />
              </div>
              <span className="dl-bar-lbl mono">{m.label.split(' ')[0]}</span>
            </div>
          ))}
        </div>
        <div className="dl-legend" style={{ display: 'flex', gap: 18, marginTop: 12 }}>
          <div><i style={{ background: 'var(--dim)' }} />Fuel</div>
          <div><i style={{ background: 'var(--faint)', opacity: .55 }} />Everything else</div>
        </div>
      </div>

      <div className="dl-panelbox">
        <h3>COST OF OWNERSHIP</h3>
        <div className="dl-kvrows">
          <div><span>Lifetime total</span><b className="mono">{formatCurrency(summary?.totalCost ?? 0, currency)}</b></div>
          <div><span>Cost / {distanceUnit}</span><b className="mono">
            {summary?.costPerDistance != null ? formatCurrency(summary.costPerDistance, currency) : '—'}
          </b></div>
          <div><span>This month, fuel</span><b className="mono">{formatCurrency(summary?.monthlyFuelCost ?? 0, currency)}</b></div>
          <div><span>Avg economy</span><b className="mono">{econ ? `${econ} ${economyLabel(distanceUnit, economyUnit)}` : '—'}</b></div>
        </div>
      </div>

      <div className="dl-panelbox">
        <h3>SPEND BY CATEGORY</h3>
        {exp.byCategory.length === 0 ? (
          <p className="dl-hint">Nothing logged in this range yet.</p>
        ) : (
          <div className="dl-legend">
            {exp.byCategory.map((c, i) => {
              const pct = total ? Math.round((c.amount / total) * 100) : 0
              const ramp = ['var(--text)', 'var(--dim)', 'var(--faint)', 'var(--line2)']
              return (
                <div key={c.category} style={{ display: 'block', padding: '6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text)' }}>{c.category}</span>
                    <span className="mono">{formatCurrency(c.amount, currency)} · {pct}%</span>
                  </div>
                  <div className="dl-track">
                    <div style={{ width: `${pct}%`, background: ramp[i % ramp.length] }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="dl-panelbox">
        <h3>QUARTERS &amp; YEARS</h3>
        <div className="dl-kvrows">
          {exp.quarterly.slice(-3).reverse().map(q => (
            <div key={q.quarter}><span>{q.quarter}</span><b className="mono">{formatCurrency(q.amount, currency)}</b></div>
          ))}
          {exp.yearly.slice(-2).reverse().map(y => (
            <div key={y.year}><span>{y.year}</span><b className="mono">{formatCurrency(y.amount, currency)}</b></div>
          ))}
        </div>
        <button className="dl-export-btn" onClick={exportCsv}>⤓ Export CSV to Downloads</button>
      </div>
    </div>
  )
}
