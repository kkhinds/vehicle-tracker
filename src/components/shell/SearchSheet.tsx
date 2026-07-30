import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDate } from '@/lib/utils'
import type { TimelineEntry } from '@/env'

interface SearchSheetProps {
  entries: TimelineEntry[]
  distanceUnit: string
  onOpen: (entry: TimelineEntry) => void
}

const TAG: Record<string, string> = {
  fuel: 'FUEL', service: 'SERVICE', tires: 'TIRES', fluid: 'FLUID',
  insurance: 'INSUR', docs: 'DOCS',
}

/**
 * Searches what the spine already has in memory — every entry for the current
 * vehicle. No IPC round trip, so results land as you type.
 */
export default function SearchSheet({ entries, distanceUnit, onOpen }: SearchSheetProps) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // The sheet moves focus to its heading on open, and parent effects run after
  // child ones — so claim the caret on the next tick or the heading wins.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return entries.slice(0, 12)
    // Every word has to appear somewhere in the row, so "shell june" narrows.
    const words = needle.split(/\s+/)
    return entries.filter(e => {
      const hay = [
        e.title, e.subtitle, e.value ?? '', e.kind, formatDate(e.date), e.date,
        e.odometer != null ? String(e.odometer) : '',
      ].join(' ').toLowerCase()
      return words.every(w => hay.includes(w))
    }).slice(0, 40)
  }, [q, entries])

  return (
    <>
      <div className="dl-field">
        <label htmlFor="dl-q">Search this vehicle's log</label>
        <input
          id="dl-q"
          ref={inputRef}
          type="text"
          placeholder="station, part, month, amount…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="dl-hint">
          {q.trim()
            ? `${results.length} match${results.length === 1 ? '' : 'es'}`
            : `${entries.length} entries — showing the most recent`}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        {results.map(e => (
          <button key={e.id} className="dl-sresult" onClick={() => onOpen(e)}>
            <span className="dl-tag" aria-hidden="true">{TAG[e.kind] ?? e.kind.toUpperCase()}</span>
            <span className="dl-sresult-main">
              <b>{e.title}</b>
              <span>{e.subtitle}</span>
            </span>
            <span className="dl-sresult-meta mono">
              {formatDate(e.date)}
              {e.odometer != null && <><br />{e.odometer.toLocaleString()} {distanceUnit}</>}
            </span>
          </button>
        ))}
        {q.trim() && results.length === 0 && (
          <p className="dl-hint" style={{ marginTop: 16 }}>Nothing matches that.</p>
        )}
      </div>
    </>
  )
}
