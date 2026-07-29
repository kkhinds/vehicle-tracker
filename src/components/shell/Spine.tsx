import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import type { AheadItem, EntryKind, TimelineEntry } from '@/env'
import type { Lens } from './LensBar'

interface SpineProps {
  entries: TimelineEntry[]
  ahead: AheadItem[]
  odometer: number
  distanceUnit: string
  lens: Lens
  onOpenEntry: (entry: TimelineEntry) => void
  onOpenAhead: (item: AheadItem) => void
  onLogFirst: () => void
  onManageIntervals: () => void
}

const TAG: Record<EntryKind, string> = {
  fuel: 'FUEL', service: 'SERVICE', tires: 'TIRES', fluid: 'FLUID',
  insurance: 'INSUR', docs: 'DOCS', notes: 'NOTE',
}

const EMPTY_COPY: Record<string, string> = {
  fuel: 'No fill-ups yet — log the first one and economy starts computing.',
  service: 'No services logged. The road ahead is already planned from your drivetrain.',
  tires: 'No tire records. Add the current set to start tread tracking.',
  fluid: 'No top-ups logged. A steady top-up pattern is worth knowing about.',
  insurance: 'No policy on file. Add one to get renewal reminders.',
  docs: 'No documents. Add road tax or registration to track expiry.',
  notes: 'No notes for this vehicle.',
  all: 'Nothing logged yet for this vehicle.',
}

/** How far ahead the spine looks before folding the rest into one row. */
const HORIZON_DAYS = 240
/** Keep TODAY above the fold — the rest of the road folds into the overflow row. */
const AHEAD_MAX = 4

function monthKey(date: string): string {
  return date.slice(0, 7)
}

export default function Spine({
  entries, ahead, odometer, distanceUnit, lens,
  onOpenEntry, onOpenAhead, onLogFirst, onManageIntervals,
}: SpineProps) {
  const shownEntries = useMemo(
    () => lens === 'all' ? entries : entries.filter(e => e.kind === lens),
    [entries, lens]
  )
  const lensAhead = useMemo(
    () => lens === 'all' ? ahead : ahead.filter(a => a.kind === lens),
    [ahead, lens]
  )
  const shownAhead = useMemo(() => {
    const withinHorizon = lensAhead.filter(a => {
      if (!a.projectedDate) return a.status !== 'ok'
      const days = (parseISO(a.projectedDate).getTime() - Date.now()) / 86_400_000
      return days <= HORIZON_DAYS
    })
    // Sorted farthest-first, so the nearest items are at the end — keep those.
    return withinHorizon.slice(-AHEAD_MAX)
  }, [lensAhead])
  const beyondHorizon = lensAhead.length - shownAhead.length

  // Group history under month headers; headers only exist where entries remain
  // after filtering, so a lens never shows an empty month.
  const months = useMemo(() => {
    const groups: { key: string; label: string; items: TimelineEntry[] }[] = []
    for (const e of shownEntries) {
      const key = monthKey(e.date)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.items.push(e)
      else groups.push({ key, label: format(parseISO(e.date), 'MMMM yyyy').toUpperCase(), items: [e] })
    }
    return groups
  }, [shownEntries])

  if (!shownEntries.length && !shownAhead.length) {
    return (
      <div className="dl-empty">
        <b>Nothing here yet</b>
        {EMPTY_COPY[lens] ?? EMPTY_COPY.all}
        <br />
        <button onClick={onLogFirst}>+ Log the first one</button>
      </div>
    )
  }

  return (
    <div className="dl-spine">
      {shownAhead.length > 0 && (
        <div className="dl-ahead">
          <p className="dl-section-lbl">ROAD AHEAD</p>
          {shownAhead.map(a => (
            <div key={a.id} className={`dl-entry ${a.status === 'overdue' ? 'overdue' : a.status === 'due-soon' ? 'due' : ''}`}>
              <span className="dl-date-mark mono" aria-hidden="true">
                <b>{a.projectedDate
                  ? `${a.estimated ? 'EST ' : ''}${format(parseISO(a.projectedDate), 'd MMM').toUpperCase()}`
                  : '—'}</b>
                {a.dueKm != null && <><br /><span className="km">{a.estimated ? '~' : ''}{a.dueKm.toLocaleString()} {distanceUnit}</span></>}
              </span>
              <span className="dl-node" aria-hidden="true" />
              <button className="dl-card" onClick={() => onOpenAhead(a)}>
                <span className="sr-only">
                  {a.status === 'overdue' ? 'Overdue' : a.status === 'due-soon' ? 'Due soon' : 'Upcoming'}
                  {a.projectedDate ? `, ${a.estimated ? 'estimated ' : ''}${format(parseISO(a.projectedDate), 'd MMMM yyyy')}` : ''}:
                </span>
                <span className="dl-tag" aria-hidden="true">{TAG[a.kind]}</span>
                <span className="dl-c-main">
                  <span className="dl-c-title">{a.title}</span>
                  <span className="dl-c-sub">{a.subtitle}</span>
                </span>
                <span className="dl-c-val">
                  {a.daysRemaining != null
                    ? <>{Math.abs(a.daysRemaining)} <small>{a.daysRemaining < 0 ? 'days over' : 'days'}</small></>
                    : a.kmRemaining != null
                      ? <>{Math.abs(Math.round(a.kmRemaining)).toLocaleString()} <small>{distanceUnit}</small></>
                      : null}
                </span>
              </button>
            </div>
          ))}
          {beyondHorizon > 0 && (
            <button className="dl-more-row" onClick={onManageIntervals}>
              {beyondHorizon} more upcoming — view all
            </button>
          )}
        </div>
      )}

      <div className="dl-today">
        <span className="dl-node-now" aria-hidden="true" />
        <span className="dl-today-lbl">TODAY · {odometer.toLocaleString()} {distanceUnit.toUpperCase()}</span>
        <span className="dl-today-line" />
      </div>

      {months.map(m => (
        <div key={m.key}>
          <div className="dl-month-h">
            <span>{m.label}</span>
            <span className="dl-rule" />
            <span className="dl-sum mono">{m.items.length} {m.items.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          {m.items.map(e => (
            <div key={e.id} className="dl-entry">
              <span className="dl-date-mark mono" aria-hidden="true">
                <b>{format(parseISO(e.date), 'd MMM').toUpperCase()}</b>
                {e.odometer != null && <><br /><span className="km">{e.odometer.toLocaleString()} {distanceUnit}</span></>}
              </span>
              <span className="dl-node" aria-hidden="true" />
              <button className="dl-card" onClick={() => onOpenEntry(e)}>
                <span className="sr-only">
                  {format(parseISO(e.date), 'd MMMM yyyy')}
                  {e.odometer != null ? `, ${e.odometer.toLocaleString()} ${distanceUnit}` : ''}:
                </span>
                <span className="dl-tag" aria-hidden="true">{TAG[e.kind]}</span>
                <span className="dl-c-main">
                  <span className="dl-c-title">{e.title}</span>
                  <span className="dl-c-sub">{e.subtitle}</span>
                </span>
                <span className="dl-c-val">
                  {e.value}
                  {e.valueSub && <><br /><small>{e.valueSub}</small></>}
                </span>
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
