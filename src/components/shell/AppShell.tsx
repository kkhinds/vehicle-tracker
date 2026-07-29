import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import Hero from './Hero'
import LensBar, { type Lens } from './LensBar'
import Spine from './Spine'
import Sheet from './Sheet'
import Stats from './Stats'
import HelpSheet from './HelpSheet'
import LogForm, { KIND_TO_LOG, type LogType } from './LogForm'
import {
  IntervalsSheet, GarageSheet, BackupsSheet, SettingsSheet, OdometerSheet, TireSetSheet,
} from './ManagementSheets'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { formatDate } from '@/lib/utils'
import type { DashboardSummary } from '@/types'
import type { AheadItem, EntryKind, TimelineEntry } from '@/env'

/**
 * Driver's Log shell: hero + lens bar, no sidebar. Lens state lives here; the
 * spine, context strips and sheets land in later phases.
 */
export default function AppShell() {
  const { settings, refreshSettings } = useSettings()
  const { vehicles, currentVehicle, currentVehicleId, switchVehicle, refreshVehicles } = useVehicles()
  const [lens, setLens] = useState<Lens>('all')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [alerting, setAlerting] = useState<Set<number>>(new Set())
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [ahead, setAhead] = useState<AheadItem[]>([])
  const [loading, setLoading] = useState(true)
  const spineRef = useRef<HTMLDivElement>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [logType, setLogType] = useState<LogType>('fuel')
  const [detail, setDetail] = useState<TimelineEntry | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  type SheetName = 'settings' | 'garage' | 'intervals' | 'backups' | 'odometer' | 'tireset' | 'help'
  const [sheet, setSheet] = useState<SheetName | null>(null)

  const reload = useCallback(async () => {
    const [s, e, a] = await Promise.all([
      window.api.dashboard.getSummary(),
      window.api.timeline.getEntries(),
      window.api.timeline.getAhead(),
    ])
    setSummary(s); setEntries(e); setAhead(a.items); setLoading(false)
  }, [])

  useEffect(() => { setLoading(true); reload() }, [currentVehicleId, reload])

  // The spine's accent segment runs from the top down to TODAY, so its length
  // depends on how tall the rendered road-ahead block happens to be.
  useLayoutEffect(() => {
    const el = spineRef.current?.querySelector<HTMLElement>('.dl-spine')
    const aheadEl = spineRef.current?.querySelector<HTMLElement>('.dl-ahead')
    if (el) el.style.setProperty('--ahead-h', `${aheadEl?.offsetHeight ?? 0}px`)
  }, [entries, ahead, lens])

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

  // Carried into the next fill-up so the weekly job is mostly pre-filled.
  const lastFuel = useMemo(() => {
    const e = entries.find(x => x.kind === 'fuel')
    if (!e) return null
    const station = e.title.startsWith('Fill-up — ') ? e.title.slice('Fill-up — '.length) : null
    const price = e.subtitle.match(/\$([\d.]+)\/L/)?.[1]
    return { station, pricePerLitre: price ? parseFloat(price) : null }
  }, [entries])

  function openLog(type: LogType) { setLogType(type); setLogOpen(true) }

  const [table, id] = detail ? detail.id.split(':') : []
  async function deleteEntry() {
    if (!detail) return
    const api = window.api as unknown as Record<string, { delete?: (id: number) => Promise<unknown> }>
    const map: Record<string, string> = {
      fuel: 'fuel', service: 'maintenance', fluid: 'fluids', insurance: 'insurance',
      docs: 'documents', notes: 'notes', tireset: 'tires', rotation: 'tires', tires: 'tires',
    }
    const key = map[table]
    try {
      if (key === 'tires') {
        if (table === 'tireset') await window.api.tires.deleteSet(Number(id))
        else if (table === 'rotation') await window.api.tires.deleteRotation(Number(id))
        else await window.api.tires.deleteInspection(Number(id))
      } else {
        await api[key]?.delete?.(Number(id))
      }
      setDetail(null); setConfirmDelete(false)
      toast.success('Deleted')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

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
        onOpenGarage={() => setSheet('garage')}
        onEditOdometer={() => setSheet('odometer')}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSheet('settings')}
      />
      <LensBar
        lens={lens}
        onChange={setLens}
        vehicleName={currentVehicle?.nickname ?? 'No vehicle'}
        onOpenGarage={() => setSheet('garage')}
        onSearch={soon}
      />
      <main className="shell" style={{ paddingBlock: 32, paddingBottom: 130 }} ref={spineRef}>
        {loading ? (
          <p style={{ color: 'var(--dim)', fontSize: 13 }}>Loading…</p>
        ) : lens === 'stats' ? (
          <Stats
            summary={summary}
            currency={settings.currency}
            distanceUnit={settings.distance_unit}
            economyUnit={settings.economy_unit}
          />
        ) : (
          <Spine
            entries={entries}
            ahead={ahead}
            odometer={currentVehicle?.current_odometer ?? 0}
            distanceUnit={settings.distance_unit}
            lens={lens}
            onOpenEntry={setDetail}
            onOpenAhead={a => openLog(KIND_TO_LOG[a.kind])}
            onLogFirst={() => openLog(lens === 'all' ? 'fuel' : KIND_TO_LOG[lens])}
            onManageIntervals={() => setSheet(lens === 'tires' ? 'tireset' : 'intervals')}
          />
        )}
      </main>

      <button
        className="dl-fab"
        onClick={() => openLog(lens === 'all' || lens === 'stats' ? 'fuel' : KIND_TO_LOG[lens as EntryKind])}
        aria-label="Log an entry"
      >
        <span className="plus" aria-hidden="true">+</span> LOG
      </button>

      <Sheet
        open={logOpen}
        title={`Quick log — ${currentVehicle?.nickname ?? ''}`}
        onClose={() => setLogOpen(false)}
      >
        <LogForm
          initialType={logType}
          odometer={currentVehicle?.current_odometer ?? 0}
          distanceUnit={settings.distance_unit}
          lastFuel={lastFuel}
          onCancel={() => setLogOpen(false)}
          onSaved={what => {
            setLogOpen(false)
            toast.success(what)
            refreshVehicles()
            reload()
          }}
        />
      </Sheet>

      <Sheet
        open={detail !== null}
        title={detail?.title ?? ''}
        subtitle={detail ? `${currentVehicle?.nickname ?? ''} · ${formatDate(detail.date)}${detail.odometer != null ? ` · ${detail.odometer.toLocaleString()} ${settings.distance_unit}` : ''}` : ''}
        onClose={() => { setDetail(null); setConfirmDelete(false) }}
      >
        {detail && (
          <>
            <div className="dl-kv">
              <div><span>Type</span><b>{detail.kind}</b></div>
              <div><span>Date</span><b className="mono">{formatDate(detail.date)}</b></div>
              {detail.odometer != null && (
                <div><span>Odometer</span><b className="mono">{detail.odometer.toLocaleString()} {settings.distance_unit}</b></div>
              )}
              {detail.value && <div><span>Amount</span><b className="mono">{detail.value}</b></div>}
              {detail.valueSub && <div><span>Economy</span><b className="mono">{detail.valueSub}</b></div>}
            </div>
            <p style={{ color: 'var(--dim)', fontSize: 13, marginTop: 12 }}>{detail.subtitle}</p>
            <div className="dl-btnrow">
              <button className="dl-save dl-ghost" onClick={soon}>Edit</button>
              <button
                className="dl-save dl-danger"
                onClick={() => confirmDelete ? deleteEntry() : setConfirmDelete(true)}
              >
                {confirmDelete ? 'Delete — click again' : 'Delete…'}
              </button>
            </div>
            <p className="dl-microcopy">Editing lands next; delete asks twice</p>
          </>
        )}
      </Sheet>

      <Sheet open={sheet === 'settings'} title="Settings" onClose={() => setSheet(null)}>
        <SettingsSheet
          onOpenBackups={() => setSheet('backups')}
          onOpenOdometer={() => setSheet('odometer')}
          onOpenHelp={() => setSheet('help')}
          onChanged={async () => { await refreshSettings(); await refreshVehicles(); reload() }}
        />
      </Sheet>

      <Sheet
        open={sheet === 'garage'}
        title="Garage"
        subtitle="Every vehicle · click to switch"
        onClose={() => setSheet(null)}
      >
        <GarageSheet
          vehicles={vehicles}
          currentId={currentVehicleId}
          distanceUnit={settings.distance_unit}
          onSwitch={id => { switchVehicle(id); setSheet(null) }}
        />
      </Sheet>

      <Sheet
        open={sheet === 'intervals'}
        title={`Service intervals — ${currentVehicle?.nickname ?? ''}`}
        subtitle="Click a row to edit, or ✓ to mark it done"
        onClose={() => setSheet(null)}
      >
        <IntervalsSheet
          odometer={currentVehicle?.current_odometer ?? 0}
          distanceUnit={settings.distance_unit}
          onChanged={reload}
        />
      </Sheet>

      <Sheet open={sheet === 'backups'} title="Backups & data" onClose={() => setSheet(null)}>
        <BackupsSheet />
      </Sheet>

      <Sheet
        open={sheet === 'help'}
        title="How this works"
        subtitle="The short version"
        onClose={() => setSheet(null)}
      >
        <HelpSheet />
      </Sheet>

      <Sheet
        open={sheet === 'odometer'}
        title={`Correct odometer — ${currentVehicle?.nickname ?? ''}`}
        subtitle="Fixes a wrong reading"
        onClose={() => setSheet(null)}
      >
        <OdometerSheet
          current={currentVehicle?.current_odometer ?? 0}
          distanceUnit={settings.distance_unit}
          onSaved={async () => { setSheet(null); await refreshSettings(); await refreshVehicles(); reload() }}
        />
      </Sheet>

      <Sheet
        open={sheet === 'tireset'}
        title={`Tires — ${currentVehicle?.nickname ?? ''}`}
        onClose={() => setSheet(null)}
      >
        <TireSetSheet
          distanceUnit={settings.distance_unit}
          odometer={currentVehicle?.current_odometer ?? 0}
          onChanged={reload}
        />
      </Sheet>
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
