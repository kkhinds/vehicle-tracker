import { useRef } from 'react'

export const LENSES = [
  'all', 'fuel', 'service', 'tires', 'fluid', 'insurance', 'docs',
] as const
export type Lens = (typeof LENSES)[number] | 'stats'

const LABELS: Record<string, string> = {
  all: 'ALL', fuel: 'FUEL', service: 'SERVICE', tires: 'TIRES',
  fluid: 'FLUIDS', insurance: 'INSURANCE', docs: 'DOCS',
}

/** Tab order left to right, which is also the arrow-key order. */
const ORDER: Lens[] = [...LENSES, 'stats']

interface LensBarProps {
  lens: Lens
  onChange: (lens: Lens) => void
  vehicleName: string
  onOpenGarage: () => void
  onSearch: () => void
}

/**
 * Primary navigation. Tabs rather than plain buttons — switching a lens swaps
 * the view, so screen readers need the state. The bar keeps the shared left
 * edge but runs to the right edge; constraining it to the content column makes
 * the pills overflow and paint a scrollbar.
 *
 * Declaring the tab role promises arrow-key movement and one stop in the tab
 * order, so both are implemented rather than left to the label alone.
 */
export default function LensBar({ lens, onChange, vehicleName, onOpenGarage, onSearch }: LensBarProps) {
  const barRef = useRef<HTMLElement>(null)

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    let next: Lens | null = null
    if (step !== 0) next = ORDER[(ORDER.indexOf(lens) + step + ORDER.length) % ORDER.length]
    else if (e.key === 'Home') next = ORDER[0]
    else if (e.key === 'End') next = ORDER[ORDER.length - 1]
    if (!next) return

    e.preventDefault()
    onChange(next)
    // Focus follows selection, which is what the tab pattern expects when
    // switching is instant and cheap.
    barRef.current?.querySelector<HTMLElement>(`[data-lens="${next}"]`)?.focus()
  }

  const tab = (l: Lens, className: string) => (
    <button
      key={l}
      className={className}
      role="tab"
      id={`dl-tab-${l}`}
      data-lens={l}
      aria-selected={lens === l}
      aria-controls="dl-lens-panel"
      // One stop for the whole set: Tab moves past it, arrows move within it.
      tabIndex={lens === l ? 0 : -1}
      onClick={() => onChange(l)}
    >
      {l === 'stats' ? 'STATS' : LABELS[l]}
    </button>
  )

  return (
    <nav className="dl-lens shell" aria-label="Views" ref={barRef}>
      <button className="dl-vchip" onClick={onOpenGarage} aria-label={`Vehicle: ${vehicleName}. Open garage`}>
        <svg className="dl-car" viewBox="0 0 100 44" aria-hidden="true">
          <path d="M4 32 h6 l6 -12 h26 l4 -8 h18 l6 8 h16 l8 6 v6 h-8 M22 32 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M68 32 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M36 32 h32" />
        </svg>
        <span className="dl-vlabel">{vehicleName.toUpperCase()}</span> ▾
      </button>

      {/* One tablist, so STATS belongs to the same set the arrows walk. */}
      <div className="dl-tabs" role="tablist" aria-label="Filter the log" onKeyDown={onKeyDown}>
        {LENSES.map(l => tab(l, 'dl-pill'))}

        {/* Vite sets this only for `npm run dev`, so a built app never shows it. */}
        {import.meta.env.DEV && <span className="dl-devtag">DEV</span>}

        <span className="dl-gap" />
        {tab('stats', 'dl-pill dl-stats-pill')}
      </div>

      <button className="dl-search" onClick={onSearch}>
        <span className="mono">Ctrl K</span><span className="dl-stext"> — search the log…</span>
      </button>
    </nav>
  )
}
