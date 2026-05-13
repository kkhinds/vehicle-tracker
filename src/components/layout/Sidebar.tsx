import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Fuel, Wrench, Calendar, Shield,
  PieChart, FileText, Settings, Truck
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/fuel', icon: Fuel, label: 'Fuel Log' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { to: '/schedule', icon: Calendar, label: 'Service Schedule' },
  { to: '/insurance', icon: Shield, label: 'Insurance' },
  { to: '/expenses', icon: PieChart, label: 'Expenses' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Truck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">D-Max Tracker</p>
          <p className="text-xs text-muted-foreground">2022 Isuzu D-Max</p>
        </div>
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
        <p className="text-xs text-muted-foreground">v1.0.0 · Local only</p>
      </div>
    </aside>
  )
}
