import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Fuel, Wrench, Calendar, Shield,
  PieChart, FileText, Settings, Car, CircleDot, FileBadge2,
  ChevronsUpDown, Plus
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useVehicles } from '@/hooks/useVehicles'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/fuel', icon: Fuel, label: 'Fuel Log' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { to: '/schedule', icon: Calendar, label: 'Service Schedule' },
  { to: '/tires', icon: CircleDot, label: 'Tires' },
  { to: '/insurance', icon: Shield, label: 'Insurance' },
  { to: '/documents', icon: FileBadge2, label: 'Documents' },
  { to: '/expenses', icon: PieChart, label: 'Expenses' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/vehicles', icon: Car, label: 'My Vehicles' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const { vehicles, currentVehicle, switchVehicle } = useVehicles()
  const [pickerOpen, setPickerOpen] = useState(false)

  const subtitle = currentVehicle
    ? `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}`
    : 'No vehicle selected'

  const activeVehicles = vehicles.filter(v => !v.is_archived)

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card">
      {/* Vehicle picker */}
      <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-3 border-b border-border px-4 py-5 hover:bg-accent/50 transition-colors text-left w-full"
            aria-label="Switch vehicle"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shrink-0">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight truncate">
                {currentVehicle?.nickname ?? 'No vehicle'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Switch vehicle</DropdownMenuLabel>
          {activeVehicles.map(v => (
            <DropdownMenuItem
              key={v.id}
              onSelect={() => switchVehicle(v.id)}
              className={cn(
                'flex flex-col items-start gap-0',
                v.id === currentVehicle?.id && 'bg-accent'
              )}
            >
              <span className="font-medium">{v.nickname}</span>
              <span className="text-xs text-muted-foreground">{v.year} {v.make} {v.model}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <NavLink to="/vehicles" className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" /> Add or manage vehicles
            </NavLink>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
