import { Link } from 'react-router-dom'

/**
 * Wrapper for the pre-v3 screens. They still hold a few things the Driver's Log
 * can't do yet — editing a record, photos, adding a vehicle or a tire set — so
 * they stay reachable until those land, with a way back.
 */
export default function LegacyFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="dl-legacy-bar">
        <Link to="/" className="dl-legacy-back">← Driver's Log</Link>
        <span>Old screen — kept for what the new one can't do yet</span>
        <nav className="dl-legacy-nav">
          <Link to="/legacy/fuel">Fuel</Link>
          <Link to="/legacy/maintenance">Maintenance</Link>
          <Link to="/legacy/tires">Tires</Link>
          <Link to="/legacy/notes">Notes</Link>
          <Link to="/legacy/vehicles">Vehicles</Link>
          <Link to="/legacy/settings">Settings</Link>
        </nav>
      </div>
      <div className="dl-legacy-body">{children}</div>
    </>
  )
}
