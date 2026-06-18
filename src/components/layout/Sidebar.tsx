import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Fuel, Wrench, Calendar, Shield,
  PieChart, FileText, Settings, Car, CircleDot, FileBadge2,
  Droplet, ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVehicles } from '@/hooks/useVehicles'
import AppLogo from '@/components/shared/AppLogo'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/fuel', icon: Fuel, label: 'Fuel Log' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { to: '/schedule', icon: Calendar, label: 'Service Schedule' },
  { to: '/tires', icon: CircleDot, label: 'Tires' },
  { to: '/fluids', icon: Droplet, label: 'Fluids' },
  { to: '/insurance', icon: Shield, label: 'Insurance' },
  { to: '/documents', icon: FileBadge2, label: 'Documents' },
  { to: '/expenses', icon: PieChart, label: 'Expenses' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/vehicles', icon: Car, label: 'My Vehicles' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const MANAGE_SENTINEL = '__manage__'

export default function Sidebar() {
  const { vehicles, currentVehicle, switchVehicle } = useVehicles()
  const navigate = useNavigate()
  const activeVehicles = vehicles.filter(v => !v.is_archived)
  const subtitle = currentVehicle
    ? `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}`
    : 'No vehicle selected'

  function onPick(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    if (v === MANAGE_SENTINEL) navigate('/vehicles')
    else if (v) switchVehicle(Number(v))
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card">
      {/* Vehicle picker — native <select> overlays the visible label so the
          OS picker opens on any click in the header. ponytail: dropdown-menu
          dep + library go away; OS handles the popup. */}
      <div className="relative flex items-center gap-3 border-b border-border px-4 py-5 hover:bg-accent/50 transition-colors">
        <AppLogo size={36} className="shrink-0 pointer-events-none" />
        <div className="flex-1 min-w-0 pointer-events-none">
          <p className="text-sm font-bold text-foreground leading-tight truncate">
            {currentVehicle?.nickname ?? 'Vehicle Tracker'}
          </p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 pointer-events-none" />
        <select
          value={currentVehicle?.id ?? ''}
          onChange={onPick}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Switch vehicle"
        >
          {activeVehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.nickname} — {v.year} {v.make} {v.model}
            </option>
          ))}
          <option value={MANAGE_SENTINEL}>＋ Add or manage vehicles…</option>
        </select>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors mx-2 rounded-md',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">v2.0.0 · Local only</p>
      </div>
    </aside>
  )
}
