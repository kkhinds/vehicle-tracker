import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatDate, todayISO } from '@/lib/utils'
import type { BackupStatus, UpdaterStatus } from '@/env'
import type { ServiceInterval, TireSet, Vehicle } from '@/types'

/* ── Service intervals ─────────────────────────────────────────────────────
   The capability the redesign was missing most: 18 intervals with no way to
   edit one or mark it done. */
export function IntervalsSheet({ odometer, distanceUnit, onChanged }: {
  odometer: number; distanceUnit: string; onChanged: () => void
}) {
  const [rows, setRows] = useState<ServiceInterval[]>([])
  const [editing, setEditing] = useState<ServiceInterval | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  const load = () => window.api.schedule.getAll().then(setRows)
  useEffect(() => { load() }, [])

  async function markDone(iv: ServiceInterval) {
    await window.api.schedule.complete(iv.id, odometer, todayISO())
    toast.success(`${iv.name} marked done`)
    load(); onChanged()
  }

  async function saveEdit() {
    if (!editing) return
    await window.api.schedule.update(editing.id, {
      name: form.name || editing.name,
      interval_km: parseFloat(form.km) || editing.interval_km,
      interval_months: form.months ? parseFloat(form.months) : null,
      last_done_km: form.lastKm ? parseFloat(form.lastKm) : editing.last_done_km,
      last_done_date: form.lastDate || editing.last_done_date,
    })
    toast.success('Interval updated')
    setEditing(null); load(); onChanged()
  }

  if (editing) {
    return (
      <>
        <div className="dl-field">
          <label htmlFor="iv-name">Name</label>
          <input id="iv-name" type="text" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="dl-frow">
          <div className="dl-field">
            <label htmlFor="iv-km">Every ({distanceUnit})</label>
            <input id="iv-km" className="mono" value={form.km ?? ''} onChange={e => setForm({ ...form, km: e.target.value })} />
          </div>
          <div className="dl-field">
            <label htmlFor="iv-months">Or months</label>
            <input id="iv-months" className="mono" placeholder="optional" value={form.months ?? ''} onChange={e => setForm({ ...form, months: e.target.value })} />
            <div className="dl-hint">due at whichever comes first</div>
          </div>
        </div>
        <div className="dl-frow">
          <div className="dl-field">
            <label htmlFor="iv-lastkm">Last done ({distanceUnit})</label>
            <input id="iv-lastkm" className="mono" value={form.lastKm ?? ''} onChange={e => setForm({ ...form, lastKm: e.target.value })} />
          </div>
          <div className="dl-field">
            <label htmlFor="iv-lastdate">Last done date</label>
            <input id="iv-lastdate" className="mono" placeholder="yyyy-mm-dd" value={form.lastDate ?? ''} onChange={e => setForm({ ...form, lastDate: e.target.value })} />
          </div>
        </div>
        {editing.consequence_of_skipping && (
          <p className="dl-hint" style={{ marginTop: 14, lineHeight: 1.5 }}>
            <b style={{ color: 'var(--dim)' }}>Why this matters — </b>{editing.consequence_of_skipping}
          </p>
        )}
        <div className="dl-btnrow">
          <button className="dl-save" onClick={saveEdit}>Save</button>
          <button className="dl-save dl-ghost" onClick={() => setEditing(null)}>Back</button>
        </div>
      </>
    )
  }

  return (
    <>
      <div style={{ marginTop: 8 }}>
        {rows.map(iv => {
          const pct = Math.max(0, Math.min(100,
            ((odometer - (iv.last_done_km ?? 0)) / iv.interval_km) * 100))
          return (
            <div key={iv.id} className="dl-irow">
              <button
                className="dl-irow-main"
                onClick={() => {
                  setEditing(iv)
                  setForm({
                    name: iv.name, km: String(iv.interval_km),
                    months: iv.interval_months ? String(iv.interval_months) : '',
                    lastKm: iv.last_done_km != null ? String(iv.last_done_km) : '',
                    lastDate: iv.last_done_date ?? '',
                  })
                }}
              >
                <span className="dl-irow-nm">{iv.name}</span>
                <span className="dl-irow-iv mono">
                  {iv.interval_km.toLocaleString()} {distanceUnit}{iv.interval_months ? ` · ${iv.interval_months} mo` : ''}
                </span>
                <span className={`dl-meter${iv.status === 'overdue' ? ' bad' : iv.status === 'due-soon' ? ' warn' : ''}`} aria-hidden="true">
                  {Array.from({ length: 16 }, (_, i) => (
                    <i key={i} className={i < Math.round(pct / 100 * 16) ? 'on' : ''} />
                  ))}
                </span>
              </button>
              <button className="dl-irow-done" onClick={() => markDone(iv)} title="Mark done now">✓</button>
            </div>
          )
        })}
      </div>
      <p className="dl-microcopy">Click a row to edit · ✓ marks it done at {odometer.toLocaleString()} {distanceUnit}</p>
    </>
  )
}

/* ── Garage ───────────────────────────────────────────────────────────────── */
export function GarageSheet({ vehicles, currentId, distanceUnit, onSwitch }: {
  vehicles: Vehicle[]; currentId: number; distanceUnit: string; onSwitch: (id: number) => void
}) {
  return (
    <>
      <div style={{ marginTop: 8 }}>
        {vehicles.filter(v => !v.is_archived).map(v => (
          <button key={v.id} className={`dl-vrow${v.id === currentId ? ' on' : ''}`} onClick={() => onSwitch(v.id)}>
            <svg className="dl-vrow-car" viewBox="0 0 100 44" aria-hidden="true">
              <path d="M4 32 h6 l6 -12 h26 l4 -8 h18 l6 8 h16 l8 6 v6 h-8 M22 32 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M68 32 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M36 32 h32" />
            </svg>
            <span className="dl-vrow-nm">
              <b>{v.nickname.toUpperCase()}</b>
              <span className="mono">{v.current_odometer.toLocaleString()} {distanceUnit} · {v.year} {v.make} {v.model}</span>
            </span>
            {v.id === currentId && <span className="dl-chip ok"><span className="dot" aria-hidden="true" />ACTIVE</span>}
          </button>
        ))}
      </div>
      <p className="dl-microcopy">Adding, editing and archiving vehicles is still on the old screen — Vehicles page</p>
    </>
  )
}

/* ── Backups ──────────────────────────────────────────────────────────────── */
export function BackupsSheet() {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const load = () => window.api.backup.getStatus().then(setStatus)
  useEffect(() => { load() }, [])

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); load() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <>
      <div style={{ marginTop: 8 }}>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Last backup</b><span className="mono">
            {status?.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString() : 'none yet'}
          </span></span>
          <button className="dl-ctl" onClick={() => act(() => window.api.backup.createNow(), 'Backup created')}>Back up now</button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Frequency</b><span>{status?.frequency ?? '—'} · keep {status?.retention ?? '—'}</span></span>
          <button className="dl-ctl" onClick={() => act(async () => {
            const order = ['on_open', 'daily', 'weekly', 'manual'] as const
            const next = order[(order.indexOf((status?.frequency ?? 'daily') as never) + 1) % order.length]
            await window.api.backup.updateSettings({ frequency: next })
          }, 'Frequency changed')}>Change</button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Folder</b><span className="mono" style={{ wordBreak: 'break-all' }}>{status?.backupsDir ?? '—'}</span></span>
          <button className="dl-ctl" onClick={() => act(() => window.api.backup.chooseDir(), 'Folder updated')}>Change…</button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Copies kept</b><span>{status?.backups.length ?? 0} on disk</span></span>
          <button className="dl-ctl" onClick={() => window.api.backup.openFolder()}>Open folder</button>
        </div>
      </div>
      <div className="dl-btnrow">
        <button className="dl-save dl-ghost" onClick={() => act(async () => {
          const dest = await window.api.backup.export()
          if (!dest) throw new Error('Export cancelled')
        }, 'Exported')}>Export a copy…</button>
        <button className="dl-save dl-danger" onClick={async () => {
          const file = await window.api.backup.pickRestoreFile()
          if (!file) return
          await window.api.backup.restore(file)   // relaunches the app
        }}>Restore…</button>
      </div>
      <p className="dl-microcopy">Restoring snapshots your current data first, then restarts the app</p>
    </>
  )
}

/* ── Settings ─────────────────────────────────────────────────────────────── */
export function SettingsSheet({ onOpenBackups, onOpenOdometer, onOpenHelp, onChanged }: {
  onOpenBackups: () => void; onOpenOdometer: () => void; onOpenHelp: () => void; onChanged: () => Promise<void>
}) {
  const [s, setS] = useState<Record<string, unknown> | null>(null)
  const [upd, setUpd] = useState<UpdaterStatus | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.settings.get().then(v => setS(v as never))
    window.api.updater.getStatus().then(setUpd)
    window.api.app.getVersion().then(setVersion)
    return window.api.updater.onStatus(setUpd)
  }, [])

  const put = async (patch: Record<string, unknown>) => {
    await window.api.settings.update(patch)
    const next = await window.api.settings.get()
    setS(next as never)
    await onChanged()
  }
  const cycle = <T,>(list: readonly T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length]

  if (!s) return <p className="dl-hint" style={{ marginTop: 16 }}>Loading…</p>

  return (
    <>
      <div style={{ marginTop: 8 }}>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Theme</b><span>dark cockpit / light</span></span>
          <button className="dl-ctl" onClick={() => put({ theme: s.theme === 'dark' ? 'light' : 'dark' })}>
            {String(s.theme)}
          </button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Distance unit</b><span>applies everywhere</span></span>
          <button className="dl-ctl" onClick={() => put({ distance_unit: cycle(['km', 'miles'] as const, s.distance_unit as 'km') })}>
            {String(s.distance_unit)}
          </button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Fuel economy</b><span>distance/L · L/100km · MPG</span></span>
          <button className="dl-ctl" onClick={() => put({ economy_unit: cycle(['distance', 'l_per_100km', 'mpg'] as const, s.economy_unit as 'distance') })}>
            {String(s.economy_unit)}
          </button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Odometer correction</b><span className="mono">{Number(s.current_odometer).toLocaleString()} {String(s.distance_unit)}</span></span>
          <button className="dl-ctl" onClick={onOpenOdometer}>Edit</button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Backups</b><span>frequency, restore, export</span></span>
          <button className="dl-ctl" onClick={onOpenBackups}>Manage</button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Notifications</b><span>service · insurance · documents</span></span>
          <button className="dl-ctl" onClick={() => put({ notifications_enabled: !s.notifications_enabled })}>
            {s.notifications_enabled ? 'On' : 'Off'}
          </button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Software update</b><span className="mono">v{version} — {upd?.phase === 'downloaded' ? 'ready to install' : upd?.phase === 'checking' ? 'checking…' : 'up to date'}</span></span>
          <button className="dl-ctl" onClick={() => upd?.phase === 'downloaded' ? window.api.updater.install() : window.api.updater.check()}>
            {upd?.phase === 'downloaded' ? 'Restart' : 'Check'}
          </button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Help</b><span>how the app works</span></span>
          <button className="dl-ctl" onClick={onOpenHelp}>Open</button>
        </div>
        <div className="dl-setrow">
          <span className="dl-lab"><b>Old screens</b><span>editing a record, photos, adding a vehicle or tire set</span></span>
          <a className="dl-ctl" href="#/legacy/fuel">Open</a>
        </div>
      </div>
      <p className="dl-microcopy">Built by Kemar Hinds</p>
    </>
  )
}

/* ── Odometer correction ──────────────────────────────────────────────────── */
export function OdometerSheet({ current, distanceUnit, onSaved }: {
  current: number; distanceUnit: string; onSaved: () => void
}) {
  const [value, setValue] = useState(String(current))
  return (
    <>
      <div className="dl-field">
        <label htmlFor="odo-in">Odometer ({distanceUnit})</label>
        <input id="odo-in" className="mono" value={value} onChange={e => setValue(e.target.value)} />
        <div className="dl-hint">service due points recalculate from this</div>
      </div>
      <button className="dl-save" onClick={async () => {
        const n = parseFloat(value)
        if (!Number.isFinite(n) || n < 0) { toast.error('Enter a valid reading'); return }
        await window.api.settings.update({ current_odometer: n })
        toast.success('Odometer corrected')
        onSaved()
      }}>Save</button>
    </>
  )
}

/* ── Tire set ─────────────────────────────────────────────────────────────── */
export function TireSetSheet({ distanceUnit, odometer, onChanged }: {
  distanceUnit: string; odometer: number; onChanged: () => void
}) {
  const [sets, setSets] = useState<TireSet[]>([])
  const load = () => window.api.tires.getSets().then(setSets)
  useEffect(() => { load() }, [])
  const active = sets.find(s => s.is_active)

  if (!sets.length) {
    return <p className="dl-hint" style={{ marginTop: 16 }}>
      No tire sets yet. Adding a set is still on the old Tires screen; once one exists you can log
      inspections and rotations from the log button.
    </p>
  }

  return (
    <>
      {active && (
        <div className="dl-kv">
          <div><span>Set</span><b>{active.brand} {active.model}</b></div>
          <div><span>Size</span><b className="mono">{active.size}</b></div>
          <div><span>Fitted</span><b className="mono">{formatDate(active.install_date)}</b></div>
          <div><span>Distance on set</span><b className="mono">{(odometer - active.install_odometer).toLocaleString()} {distanceUnit}</b></div>
        </div>
      )}
      <div className="dl-btnrow">
        <button className="dl-save dl-ghost" onClick={async () => {
          if (!active) return
          await window.api.tires.retireSet(active.id, todayISO(), odometer)
          toast.success('Set retired'); load(); onChanged()
        }}>Retire this set</button>
      </div>
      {sets.filter(s => !s.is_active).length > 0 && (
        <p className="dl-microcopy">{sets.filter(s => !s.is_active).length} retired set(s) kept in history</p>
      )}
    </>
  )
}
