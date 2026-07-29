import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Hero from './Hero'
import LensBar, { type Lens } from './LensBar'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { formatDate } from '@/lib/utils'
import type { DashboardSummary } from '@/types'

/**
 * Driver's Log shell: hero + lens bar, no sidebar. Lens state lives here; the
 * spine, context strips and sheets land in later phases.
 */
export default function AppShell() {
  const { settings, refreshSettings } = useSettings()
  const { vehicles, currentVehicle, currentVehicleId, switchVehicle } = useVehicles()
  const [lens, setLens] = useState<Lens>('all')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [alerting, setAlerting] = useState<Set<number>>(new Set())

  useEffect(() => {
    window.api.dashboard.getSummary().then(setSummary)
  }, [currentVehicleId])

  // Which vehicles need attention — drives the dot on the switcher. Cheap enough
  // to ask per vehicle; a single household query lands in Phase 4.
  useEffect(() => {
    let cancelled = false
    async function check() {
      const flagged = new Set<number>()
      const active = vehicles.filter(v => !v.is_archived)
      for (const v of active) {
        if (v.id === currentVehicleId) {
          if (summaryNeedsAttention(summary)) flagged.add(v.id)
          continue
        }
        await window.api.vehicles.setCurrent(v.id)
        const s = await window.api.dashboard.getSummary()
        if (summaryNeedsAttention(s)) flagged.add(v.id)
      }
      if (currentVehicleId) await window.api.vehicles.setCurrent(currentVehicleId)
      if (!cancelled) setAlerting(flagged)
    }
    if (vehicles.length > 1) check()
    return () => { cancelled = true }
  }, [vehicles, currentVehicleId, summary])

  const theme = settings.theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggleTheme = useCallback(async () => {
    await window.api.settings.update({ theme: theme === 'dark' ? 'light' : 'dark' })
    await refreshSettings()
  }, [theme, refreshSettings])

  const nextDue = useMemo(() => {
    const ns = summary?.nextService
    if (!ns) return null
    return {
      label: ns.name,
      km: `${ns.kmRemaining.toLocaleString()} ${settings.distance_unit}`,
      date: ns.dueDate ? formatDate(ns.dueDate) : null,
    }
  }, [summary, settings.distance_unit])

  const soon = () => toast.info('Lands in a later phase of the rebuild')

  return (
    <>
      <Hero
        vehicles={vehicles}
        current={currentVehicle}
        odometer={currentVehicle?.current_odometer ?? 0}
        distanceUnit={settings.distance_unit}
        nextDue={nextDue}
        alerting={alerting}
        onSwitchVehicle={switchVehicle}
        onOpenGarage={soon}
        onEditOdometer={soon}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={soon}
      />
      <LensBar
        lens={lens}
        onChange={setLens}
        vehicleName={currentVehicle?.nickname ?? 'No vehicle'}
        onOpenGarage={soon}
        onSearch={soon}
      />
      <main className="shell" style={{ paddingBlock: 32, minHeight: 240 }}>
        <p style={{ color: 'var(--dim)', fontSize: 13 }}>
          Lens: <b className="mono" style={{ color: 'var(--text)' }}>{lens}</b> — the spine,
          context strips and sheets arrive in the next phases.
        </p>
      </main>
    </>
  )
}

function summaryNeedsAttention(s: DashboardSummary | null): boolean {
  if (!s) return false
  if (s.nextService && s.nextService.kmRemaining <= 0) return true
  if (s.nextService?.daysRemaining != null && s.nextService.daysRemaining <= 0) return true
  if (s.upcomingDocument && s.upcomingDocument.daysRemaining <= 30) return true
  if (s.insuranceRenewal && s.insuranceRenewal.daysRemaining <= 30) return true
  return !!s.tireWarning || !!s.fluidWarning
}
