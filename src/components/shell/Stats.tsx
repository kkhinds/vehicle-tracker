import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatCurrency, formatEconomy, economyLabel, economyValue, formatDate } from '@/lib/utils'
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
/** Windows the spend panels look at. Trend stays 12 months whatever is picked. */
const RANGES = [
  { key: '12m', label: '12 MONTHS' },
  { key: 'ytd', label: 'THIS YEAR' },
  { key: 'all', label: 'ALL TIME' },
] as const
type RangeKey = (typeof RANGES)[number]['key']

function rangeDates(key: RangeKey): [string | undefined, string | undefined] {
  const today = new Date().toISOString().slice(0, 10)
  if (key === 'ytd') return [`${today.slice(0, 4)}-01-01`, today]
  if (key === 'all') return ['1900-01-01', today]
  return [undefined, undefined]   // handler's own default is the last 12 months
}

export default function Stats({ summary, currency, distanceUnit, economyUnit }: StatsProps) {
  const [exp, setExp] = useState<ExpenseSummary | null>(null)
  const [range, setRange] = useState<RangeKey>('12m')
  const [econSeries, setEconSeries] = useState<{ date: string; value: number }[]>([])

  useEffect(() => {
    const [from, to] = rangeDates(range)
    window.api.expenses.getSummary(from, to).then(setExp)
  }, [range])

  // Economy per full tank, oldest first. Only full tanks close a measured span,
  // so partial fills have no consumption figure of their own.
  useEffect(() => {
    window.api.fuel.getAll().then(rows => {
      const points = rows
        .filter(r => r.full_tank && r.consumption != null)
        .map(r => ({ date: r.date, value: economyValue(r.consumption, distanceUnit, economyUnit) }))
        .filter((p): p is { date: string; value: number } => p.value != null)
        .sort((a, b) => a.date.localeCompare(b.date))
      setEconSeries(points.slice(-12))
    })
  }, [distanceUnit, economyUnit])

  const maxMonth = useMemo(
    () => Math.max(1, ...(exp?.monthlyTrend ?? []).map(m => m.total)),
    [exp]
  )
  const months = (exp?.monthlyTrend ?? []).slice(-6)

  async function exportCsv() {
    try {
      const [from, to] = rangeDates(range)
      const path = await window.api.expenses.exportCsv(from, to)
      toast.success(`Exported to ${path}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (!exp) return <p style={{ color: 'var(--dim)', fontSize: 13 }}>Loading…</p>

  const econ = formatEconomy(summary?.avgConsumption, distanceUnit, economyUnit)
  const total = exp.byCategory.reduce((s, c) => s + c.amount, 0)

  const rangeLabel = RANGES.find(r => r.key === range)!.label

  return (
    <>
      <div className="dl-seg dl-range" role="group" aria-label="Date range">
        {RANGES.map(r => (
          <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>
        ))}
      </div>

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
        <h3>SPEND BY CATEGORY — {rangeLabel}</h3>
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
        <h3>FUEL ECONOMY — LAST {econSeries.length || ''} FULL TANKS</h3>
        {econSeries.length < 2 ? (
          <p className="dl-hint">
            Two full tanks are needed before economy has anything to compare. Partial fills
            count toward the litres but don't close a span.
          </p>
        ) : (
          <>
            <svg
              className="dl-spark"
              viewBox="0 0 300 90"
              preserveAspectRatio="none"
              role="img"
              aria-label={econSeries.map(p =>
                `${formatDate(p.date)}: ${p.value} ${economyLabel(distanceUnit, economyUnit)}`).join(', ')}
            >
              {(() => {
                const vals = econSeries.map(p => p.value)
                const lo = Math.min(...vals), hi = Math.max(...vals)
                const span = hi - lo || 1
                // Inset on every side so the end dots aren't half off the panel.
                const pt = (v: number, i: number) =>
                  `${6 + (i / (econSeries.length - 1)) * 288},${84 - ((v - lo) / span) * 78}`
                const line = vals.map(pt).join(' ')
                return (
                  <>
                    <polyline className="fill" points={`6,90 ${line} 294,90`} />
                    <polyline className="line" points={line} />
                    {vals.map((v, i) => {
                      const [x, y] = pt(v, i).split(',')
                      return <circle key={i} cx={x} cy={y} r="2.5" />
                    })}
                  </>
                )
              })()}
            </svg>
            <div className="dl-kvrows">
              <div>
                <span>Best</span>
                <b className="mono">
                  {Math[economyUnit === 'l_per_100km' ? 'min' : 'max'](...econSeries.map(p => p.value))}
                  {' '}{economyLabel(distanceUnit, economyUnit)}
                </b>
              </div>
              <div>
                <span>Latest</span>
                <b className="mono">
                  {econSeries[econSeries.length - 1].value} {economyLabel(distanceUnit, economyUnit)}
                </b>
              </div>
            </div>
          </>
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
        <p className="dl-hint">the export covers the selected range</p>
      </div>
    </div>
    </>
  )
}
