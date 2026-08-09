import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import Hero from './Hero'
import LensBar, { type Lens } from './LensBar'
import Spine from './Spine'
import Sheet from './Sheet'
import Stats from './Stats'
import HelpSheet from './HelpSheet'
import SearchSheet from './SearchSheet'
import { PhotoStrip } from './Photos'
import LogForm, { KIND_TO_LOG, type EditTarget, type LogType } from './LogForm'
import {
  IntervalsSheet, GarageSheet, BackupsSheet, SettingsSheet, OdometerSheet, TireSetSheet,
} from './ManagementSheets'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { economyLabel, formatDate, formatEconomy } from '@/lib/utils'
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
  const [edit, setEdit] = useState<EditTarget | null>(null)
  const [detailPhotos, setDetailPhotos] = useState<string[]>([])
  type SheetName = 'settings' | 'garage' | 'intervals' | 'backups' | 'odometer' | 'tireset' | 'help' | 'search'
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

  // Which vehicles need attention — drives the dot on the switcher. One query
  // covers the household; this used to make each vehicle current in turn, which
  // wrote settings (and so persisted the whole database) once per vehicle.
  useEffect(() => {
    let cancelled = false
    window.api.dashboard.getAlerts().then(ids => {
      if (!cancelled) setAlerting(new Set(ids))
    })
    return () => { cancelled = true }
  }, [vehicles, summary])

  // Attachments live on the record, not on the timeline row.
  useEffect(() => {
    if (!detail) { setDetailPhotos([]); return }
    let cancelled = false
    loadRecord(detail.id).then(r => {
      if (cancelled || !r) return
      const paths = r.receipt_photo ? [String(r.receipt_photo)]
        : r.photo ? [String(r.photo)]
        : Array.isArray(r.photos) ? (r.photos as string[])
        : []
      setDetailPhotos(paths)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail])

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
      // Past due reads as "overdue", not as a negative distance.
      km: ns.kmRemaining < 0
        ? `${Math.abs(ns.kmRemaining).toLocaleString()} ${settings.distance_unit} overdue`
        : `${ns.kmRemaining.toLocaleString()} ${settings.distance_unit}`,
      // "…overdue or 18 Nov" reads as nonsense, so the date drops once it's past.
      date: ns.kmRemaining < 0 || !ns.dueDate ? null : formatDate(ns.dueDate),
    }
  }, [summary, settings.distance_unit])

  // Ctrl/Cmd+K is the advertised way in, so it works from anywhere in the shell.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSheet(s => (s === 'search' ? null : 'search'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Carried into the next fill-up so the weekly job is mostly pre-filled.
  const lastFuel = useMemo(() => {
    const e = entries.find(x => x.kind === 'fuel')
    if (!e) return null
    const station = e.title.startsWith('Fill-up — ') ? e.title.slice('Fill-up — '.length) : null
    const price = e.subtitle.match(/\$([\d.]+)\/L/)?.[1]
    return { station, pricePerLitre: price ? parseFloat(price) : null }
  }, [entries])

  function openLog(type: LogType) { setEdit(null); setLogType(type); setLogOpen(true) }

  /** Tables the quick-log form can edit — the rest have no update handler. */
  const EDITABLE: Record<string, LogType> = {
    fuel: 'fuel', service: 'service', fluid: 'fluid', insurance: 'insurance', docs: 'docs',
  }

  // The spine carries display text, not the stored row, so anything that needs
  // real fields — the edit form, the attachment strip — fetches the record back
  // from its own table.
  async function loadRecord(entryId: string): Promise<Record<string, unknown> | null> {
    const [t, rawId] = entryId.split(':')
    const get = ({
      fuel: () => window.api.fuel.getAll(),
      service: () => window.api.maintenance.getAll(),
      fluid: () => window.api.fluids.getAll(),
      insurance: () => window.api.insurance.getAll(),
      docs: () => window.api.documents.getAll(),
    } as Record<string, () => Promise<{ id: number }[]>>)[t]
    if (!get) return null
    const record = (await get()).find(r => r.id === Number(rawId))
    return (record as unknown as Record<string, unknown>) ?? null
  }

  async function openEdit() {
    if (!detail) return
    const [t, rawId] = detail.id.split(':')
    const type = EDITABLE[t]
    if (!type) return
    const record = await loadRecord(detail.id)
    if (!record) { toast.error('That record is gone'); return }
    setDetail(null); setConfirmDelete(false)
    setEdit({ type, id: Number(rawId), record })
    setLogType(type)
    setLogOpen(true)
  }

  // Fuel rows carry raw distance-per-litre; the unit is a setting.
  const detailEconomy = detail?.valueSub ?? (() => {
    const v = formatEconomy(detail?.consumption, settings.distance_unit, settings.economy_unit)
    return v ? `${v} ${economyLabel(settings.distance_unit, settings.economy_unit)}` : null
  })()

  const [table, id] = detail ? detail.id.split(':') : []

  /** Breaks the span on a fill-up that followed unlogged ones, from the entry itself. */
  async function markMissedFills() {
    if (!detail || table !== 'fuel') return
    try {
      await window.api.fuel.update(Number(id), { missed_fills: true })
      setDetail(null)
      toast.success('Marked — that tank no longer counts toward your economy')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

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
        onSearch={() => setSheet('search')}
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
            economyUnit={settings.economy_unit}
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
        title={edit ? 'Edit entry' : `Quick log — ${currentVehicle?.nickname ?? ''}`}
        onClose={() => { setLogOpen(false); setEdit(null) }}
      >
        <LogForm
          initialType={logType}
          odometer={currentVehicle?.current_odometer ?? 0}
          distanceUnit={settings.distance_unit}
          lastFuel={lastFuel}
          edit={edit}
          fuelKind={currentVehicle?.drivetrain === 'diesel' ? 'diesel'
            : currentVehicle?.drivetrain === 'ev' ? null : 'gasoline'}
          onCancel={() => { setLogOpen(false); setEdit(null) }}
          onSaved={what => {
            setLogOpen(false)
            setEdit(null)
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
              {detail.expiresOn && (
                <div>
                  <span>{detail.kind === 'insurance' ? 'Renews' : 'Expires'}</span>
                  <b className="mono">{formatDate(detail.expiresOn)}</b>
                </div>
              )}
              {detail.daysRemaining != null && (
                <div>
                  <span>{detail.daysRemaining < 0 ? 'Overdue by' : 'Time left'}</span>
                  <b className="mono" style={{ color: detail.daysRemaining <= 30 ? 'var(--red)' : undefined }}>
                    {Math.abs(detail.daysRemaining)} day{Math.abs(detail.daysRemaining) === 1 ? '' : 's'}
                  </b>
                </div>
              )}
              {detail.value && <div><span>Amount</span><b className="mono">{detail.value}</b></div>}
              {detailEconomy && <div><span>Economy</span><b className="mono">{detailEconomy}</b></div>}
            </div>
            <p style={{ color: 'var(--dim)', fontSize: 13, marginTop: 12 }}>{detail.subtitle}</p>
            {detail.kind === 'docs' && !detail.expiresOn && (
              <p className="dl-hint" style={{ marginTop: 10 }}>
                No expiry date on this one, so it can't be counted down or remind you.
                Add one with Edit and you'll get warnings at 60, 30 and 7 days.
              </p>
            )}
            {detail.suspect && (
              <div className="dl-callout">
                <b>This tank reads better than this vehicle manages.</b>
                <p>
                  Economy is measured between full tanks. If a fill-up went unlogged, this span
                  covers fuel that was never recorded, and the figure comes out flattering. Mark it
                  and the tank is skipped — the average goes back to the truth and measuring starts
                  again from here.
                </p>
                <button className="dl-callout-btn" onClick={markMissedFills}>
                  I missed logging fill-ups before this one
                </button>
              </div>
            )}
            <PhotoStrip paths={detailPhotos} />
            <div className="dl-btnrow">
              {EDITABLE[table] && (
                <button className="dl-save dl-ghost" onClick={openEdit}>Edit</button>
              )}
              <button
                className="dl-save dl-danger"
                onClick={() => confirmDelete ? deleteEntry() : setConfirmDelete(true)}
              >
                {confirmDelete ? 'Delete — click again' : 'Delete…'}
              </button>
            </div>
            <p className="dl-microcopy">
              {EDITABLE[table] ? 'Delete asks twice' : 'Tire records are logged fresh rather than edited'}
            </p>
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
        subtitle="Switch, add or edit a vehicle"
        onClose={() => setSheet(null)}
      >
        <GarageSheet
          vehicles={vehicles}
          currentId={currentVehicleId}
          distanceUnit={settings.distance_unit}
          onSwitch={id => { switchVehicle(id); setSheet(null) }}
          onChanged={async () => {
            // Deleting the active vehicle makes the backend pick a new current
            // one, and that choice lives in settings — refresh those too.
            await refreshSettings(); await refreshVehicles(); reload()
          }}
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

      <Sheet
        open={sheet === 'search'}
        title="Search"
        subtitle={currentVehicle?.nickname ?? ''}
        onClose={() => setSheet(null)}
      >
        <SearchSheet
          entries={entries}
          distanceUnit={settings.distance_unit}
          onOpen={e => { setSheet(null); setDetail(e) }}
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
