export const LENSES = [
  'all', 'fuel', 'service', 'tires', 'fluid', 'insurance', 'docs',
] as const
export type Lens = (typeof LENSES)[number] | 'stats'

const LABELS: Record<string, string> = {
  all: 'ALL', fuel: 'FUEL', service: 'SERVICE', tires: 'TIRES',
  fluid: 'FLUIDS', insurance: 'INSURANCE', docs: 'DOCS',
}

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
 */
export default function LensBar({ lens, onChange, vehicleName, onOpenGarage, onSearch }: LensBarProps) {
  return (
    <nav className="dl-lens shell" role="tablist" aria-label="Views">
      <button className="dl-vchip" onClick={onOpenGarage} aria-label={`Vehicle: ${vehicleName}. Open garage`}>
        <svg className="dl-car" viewBox="0 0 100 44" aria-hidden="true">
          <path d="M4 32 h6 l6 -12 h26 l4 -8 h18 l6 8 h16 l8 6 v6 h-8 M22 32 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M68 32 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M36 32 h32" />
        </svg>
        <span className="dl-vlabel">{vehicleName.toUpperCase()}</span> ▾
      </button>

      {LENSES.map(l => (
        <button
          key={l}
          className="dl-pill"
          role="tab"
          aria-selected={lens === l}
          onClick={() => onChange(l)}
        >
          {LABELS[l]}
        </button>
      ))}

      <span className="dl-gap" />

      <button
        className="dl-pill dl-stats-pill"
        role="tab"
        aria-selected={lens === 'stats'}
        onClick={() => onChange('stats')}
      >
        STATS
      </button>
      <button className="dl-search" onClick={onSearch}>
        <span className="mono">Ctrl K</span><span className="dl-stext"> — search the log…</span>
      </button>
    </nav>
  )
}
