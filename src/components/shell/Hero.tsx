import { useEffect, useRef, useState } from 'react'
import type { Vehicle } from '@/types'

interface HeroProps {
  vehicles: Vehicle[]
  current: Vehicle | null
  odometer: number
  distanceUnit: string
  /** e.g. "Oil & filter — 7,112 km or 18 Nov". Null while nothing is scheduled. */
  nextDue: { label: string; km: string; date: string | null } | null
  /** Vehicle ids that have something due or overdue — drives the alert dot. */
  alerting: Set<number>
  onSwitchVehicle: (id: number) => void
  onOpenGarage: () => void
  onEditOdometer: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onOpenSettings: () => void
}

/**
 * Counts up to `value`: from zero on first paint, and from the previous
 * reading afterwards — re-running the whole climb every time a fill-up nudges
 * the odometer is noise. Static when reduced motion is on.
 */
function useCountUp(value: number): number {
  const [shown, setShown] = useState(value)
  const last = useRef<number | null>(null)
  const prefersStatic = useRef(
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    if (prefersStatic.current) { setShown(value); return }
    let raf = 0
    let start: number | null = null
    const from = last.current ?? 0
    last.current = value
    const step = (t: number) => {
      if (start === null) start = t
      const p = Math.min((t - start) / 900, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (value - from) * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return shown
}

export default function Hero({
  vehicles, current, odometer, distanceUnit, nextDue, alerting,
  onSwitchVehicle, onOpenGarage, onEditOdometer, theme, onToggleTheme, onOpenSettings,
}: HeroProps) {
  const shownOdo = useCountUp(odometer)
  const active = vehicles.filter(v => !v.is_archived)

  return (
    <section className="dl-hero">
      <svg className="dl-road" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1200 140" aria-hidden="true">
        <line x1="0" y1="140" x2="560" y2="0" />
        <line x1="1200" y1="140" x2="640" y2="0" />
        <line className="mid" x1="600" y1="140" x2="600" y2="0" />
      </svg>

      <div className="dl-hero-actions">
        <button className="dl-icon-btn" onClick={onToggleTheme}>
          {theme === 'dark' ? '☾ Dark' : '☀ Light'}
        </button>
        <button className="dl-icon-btn" onClick={onOpenSettings}>Settings</button>
      </div>

      <div className="dl-hero-in shell">
        <div className="dl-hv">
          <div className="dl-eyebrow">DRIVER'S LOG</div>
          <h1>{current ? current.nickname.toUpperCase() : 'NO VEHICLE'}</h1>
          <div className="dl-plate">
            {current
              ? <>{current.year} {current.make} {current.model}{current.license_plate ? <> · <b>{current.license_plate}</b></> : null}</>
              : 'Add a vehicle to start logging'}
          </div>
          <div className="dl-vswitch">
            {active.map(v => (
              <button
                key={v.id}
                aria-pressed={v.id === current?.id}
                onClick={() => onSwitchVehicle(v.id)}
              >
                {v.nickname.toUpperCase()}
                {alerting.has(v.id) && v.id !== current?.id && (
                  <>
                    <span className="dl-valert" aria-hidden="true" />
                    <span className="sr-only"> — attention needed</span>
                  </>
                )}
              </button>
            ))}
            <button className="dl-garage-btn" onClick={onOpenGarage}>+ Garage</button>
          </div>
        </div>

        <div className="dl-odo">
          <div className="dl-odo-label">ODOMETER</div>
          <button className="dl-odo-value mono" onClick={onEditOdometer} title="Correct odometer">
            {shownOdo.toLocaleString()}<small> {distanceUnit}</small>
          </button>
          <div className="dl-next">
            {nextDue ? (
              <>Next: {nextDue.label} — <b className="mono">{nextDue.km}</b>
              {nextDue.date && <> or <b className="mono">{nextDue.date}</b></>}</>
            ) : 'Nothing scheduled'}
          </div>
        </div>
      </div>
    </section>
  )
}
