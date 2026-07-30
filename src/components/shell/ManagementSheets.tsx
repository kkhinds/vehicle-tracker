import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatDate, todayISO } from '@/lib/utils'
import type { BackupStatus, UpdaterStatus } from '@/env'
import { DRIVETRAINS, DRIVETRAIN_LABELS } from '@/types'
import type { Drivetrain, ServiceInterval, TireSet, Vehicle } from '@/types'

/* Shared bits for the small forms in this file. The quick-log form has its own
   copy tuned to its validation; these are the plain version. */
function Field({ id, label, value, onChange, hint, error, placeholder, mono = true }: {
  id: string; label: string; value: string; onChange: (v: string) => void
  hint?: string; error?: string; placeholder?: string; mono?: boolean
}) {
  return (
    <div className={`dl-field${error ? ' error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={mono ? 'mono' : ''}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {error ? <div className="dl-err">{error}</div> : hint && <div className="dl-hint">{hint}</div>}
    </div>
  )
}

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
export function GarageSheet({ vehicles, currentId, distanceUnit, onSwitch, onChanged }: {
  vehicles: Vehicle[]; currentId: number; distanceUnit: string
  onSwitch: (id: number) => void; onChanged: () => Promise<void>
}) {
  /** null = list, 'new' = add form, Vehicle = edit form. */
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null)
  const active = vehicles.filter(v => !v.is_archived)
  const archived = vehicles.filter(v => v.is_archived)

  if (editing) {
    return (
      <VehicleForm
        vehicle={editing === 'new' ? null : editing}
        distanceUnit={distanceUnit}
        canDelete={active.length > 1}
        onCancel={() => setEditing(null)}
        onSaved={async (id, isNew) => {
          setEditing(null)
          await onChanged()
          if (isNew) onSwitch(id)
        }}
        onRemoved={async () => { setEditing(null); await onChanged() }}
      />
    )
  }

  const row = (v: Vehicle) => (
    <div className="dl-vrowwrap" key={v.id}>
      <button className={`dl-vrow${v.id === currentId ? ' on' : ''}`} onClick={() => onSwitch(v.id)}>
        <svg className="dl-vrow-car" viewBox="0 0 100 44" aria-hidden="true">
          <path d="M4 32 h6 l6 -12 h26 l4 -8 h18 l6 8 h16 l8 6 v6 h-8 M22 32 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M68 32 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M36 32 h32" />
        </svg>
        <span className="dl-vrow-nm">
          <b>{v.nickname.toUpperCase()}</b>
          <span className="mono">{v.current_odometer.toLocaleString()} {distanceUnit} · {v.year} {v.make} {v.model}</span>
        </span>
        {v.id === currentId && <span className="dl-chip ok"><span className="dot" aria-hidden="true" />ACTIVE</span>}
      </button>
      <button className="dl-ctl" onClick={() => setEditing(v)} aria-label={`Edit ${v.nickname}`}>Edit</button>
    </div>
  )

  return (
    <>
      <div style={{ marginTop: 8 }}>{active.map(row)}</div>

      {archived.length > 0 && (
        <>
          <h3 className="dl-subhead">ARCHIVED</h3>
          <div style={{ opacity: .7 }}>{archived.map(row)}</div>
        </>
      )}

      <div className="dl-btnrow">
        <button className="dl-save" onClick={() => setEditing('new')}>+ Add a vehicle</button>
      </div>
      <p className="dl-microcopy">A new vehicle gets its own service intervals from its drivetrain</p>
    </>
  )
}

function VehicleForm({ vehicle, distanceUnit, canDelete, onSaved, onCancel, onRemoved }: {
  vehicle: Vehicle | null
  distanceUnit: string
  /** The backend refuses to delete the last active vehicle; hide the button too. */
  canDelete: boolean
  onSaved: (id: number, isNew: boolean) => Promise<void>
  onCancel: () => void
  onRemoved: () => Promise<void>
}) {
  const [f, setF] = useState<Record<string, string>>(() => ({
    nickname: vehicle?.nickname ?? '',
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle ? String(vehicle.year) : String(new Date().getFullYear()),
    trim: vehicle?.trim ?? '',
    plate: vehicle?.license_plate ?? '',
    color: vehicle?.color ?? '',
    vin: vehicle?.vin ?? '',
    odometer: vehicle ? String(vehicle.current_odometer) : '0',
    purchaseDate: vehicle?.purchase_date ?? '',
  }))
  const [drivetrain, setDrivetrain] = useState<Drivetrain>(vehicle?.drivetrain ?? 'petrol-na')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k: string) => (v: string) => setF(prev => ({ ...prev, [k]: v }))

  async function save() {
    const e: Record<string, string> = {}
    if (!f.nickname.trim()) e.nickname = 'Give it a name'
    if (!f.make.trim()) e.make = 'Required'
    if (!f.model.trim()) e.model = 'Required'
    const year = parseInt(f.year, 10)
    if (!Number.isFinite(year) || year < 1900 || year > 2100) e.year = '1900–2100'
    const odo = parseFloat(f.odometer)
    if (!Number.isFinite(odo) || odo < 0) e.odometer = 'Enter a reading'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    const payload = {
      nickname: f.nickname.trim(), make: f.make.trim(), model: f.model.trim(), year,
      trim: f.trim.trim() || null, drivetrain, vin: f.vin.trim() || null,
      license_plate: f.plate.trim() || null, color: f.color.trim() || null, photo: null,
      purchase_date: f.purchaseDate || null, purchase_odometer: null, current_odometer: odo,
      is_archived: vehicle?.is_archived ?? false,
    }
    try {
      if (vehicle) {
        await window.api.vehicles.update(vehicle.id, payload)
        toast.success('Vehicle updated')
        await onSaved(vehicle.id, false)
      } else {
        const created = await window.api.vehicles.add(payload)
        toast.success(`${payload.nickname} added`)
        await onSaved(created.id, true)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function archive() {
    if (!vehicle) return
    try {
      await window.api.vehicles.update(vehicle.id, { is_archived: !vehicle.is_archived })
      toast.success(vehicle.is_archived ? 'Vehicle restored' : 'Vehicle archived')
      await onRemoved()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function remove() {
    if (!vehicle) return
    try {
      await window.api.vehicles.delete(vehicle.id)
      toast.success('Vehicle deleted')
      await onRemoved()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <>
      <h3 className="dl-subhead" style={{ marginTop: 6 }}>
        {vehicle ? `EDIT ${vehicle.nickname.toUpperCase()}` : 'ADD A VEHICLE'}
      </h3>
      <div className="dl-frow">
        <Field id="v-nick" label="Name" value={f.nickname} onChange={set('nickname')} error={errors.nickname} placeholder="The D-Max" mono={false} />
        <Field id="v-plate" label="Plate" value={f.plate} onChange={set('plate')} placeholder="optional" />
      </div>
      <div className="dl-frow">
        <Field id="v-make" label="Make" value={f.make} onChange={set('make')} error={errors.make} placeholder="Isuzu" mono={false} />
        <Field id="v-model" label="Model" value={f.model} onChange={set('model')} error={errors.model} placeholder="D-Max" mono={false} />
        <Field id="v-year" label="Year" value={f.year} onChange={set('year')} error={errors.year} />
      </div>
      <div className="dl-frow">
        <div className="dl-field">
          <label htmlFor="v-drive">Drivetrain</label>
          <select id="v-drive" value={drivetrain} onChange={e => setDrivetrain(e.target.value as Drivetrain)}>
            {DRIVETRAINS.map(d => <option key={d} value={d}>{DRIVETRAIN_LABELS[d]}</option>)}
          </select>
          <div className="dl-hint">
            {vehicle ? 'changing this leaves existing intervals alone' : 'picks the starting service intervals'}
          </div>
        </div>
        <Field
          id="v-odo" label={`Odometer (${distanceUnit})`} value={f.odometer}
          onChange={set('odometer')} error={errors.odometer}
        />
      </div>
      <div className="dl-frow">
        <Field id="v-trim" label="Trim" value={f.trim} onChange={set('trim')} placeholder="optional" mono={false} />
        <Field id="v-color" label="Colour" value={f.color} onChange={set('color')} placeholder="optional" mono={false} />
        <Field id="v-bought" label="Bought" value={f.purchaseDate} onChange={set('purchaseDate')} placeholder="yyyy-mm-dd" />
      </div>
      <Field id="v-vin" label="VIN" value={f.vin} onChange={set('vin')} placeholder="optional" />

      <div className="dl-btnrow">
        <button className="dl-save" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : vehicle ? 'Save changes' : 'Add vehicle'}
        </button>
        <button className="dl-save dl-ghost" onClick={onCancel}>Back</button>
      </div>

      {vehicle && (
        <>
          <div className="dl-btnrow">
            <button className="dl-save dl-ghost" onClick={archive}>
              {vehicle.is_archived ? 'Restore from archive' : 'Archive'}
            </button>
            {canDelete && (
              <button
                className="dl-save dl-danger"
                onClick={() => confirmDelete ? remove() : setConfirmDelete(true)}
              >
                {confirmDelete ? 'Delete — click again' : 'Delete…'}
              </button>
            )}
          </div>
          <p className="dl-microcopy">
            Archiving hides the vehicle but keeps its history. Deleting takes everything logged against
            it — fill-ups, services, photos — and can't be undone.
          </p>
        </>
      )}
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
          <span className="dl-lab"><b>Old screens</b><span>editing a record, photos</span></span>
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
  const [editing, setEditing] = useState<TireSet | 'new' | null>(null)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const load = () => window.api.tires.getSets().then(setSets)
  useEffect(() => { load() }, [])
  const active = sets.find(s => s.is_active)
  const retired = sets.filter(s => !s.is_active)

  if (editing) {
    return (
      <TireSetForm
        set={editing === 'new' ? null : editing}
        distanceUnit={distanceUnit}
        odometer={odometer}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); onChanged() }}
      />
    )
  }

  return (
    <>
      {active ? (
        <div className="dl-kv">
          <div><span>Set</span><b>{active.brand} {active.model}</b></div>
          <div><span>Size</span><b className="mono">{active.size}</b></div>
          <div><span>Fitted</span><b className="mono">{formatDate(active.install_date)}</b></div>
          <div><span>Distance on set</span><b className="mono">{Math.max(0, odometer - active.install_odometer).toLocaleString()} {distanceUnit}</b></div>
        </div>
      ) : (
        <p className="dl-hint" style={{ marginTop: 16 }}>
          No tire set fitted. Add one and the log button starts taking inspections and rotations
          against it.
        </p>
      )}

      <div className="dl-btnrow">
        {active ? (
          <>
            <button className="dl-save dl-ghost" onClick={() => setEditing(active)}>Edit set</button>
            <button className="dl-save dl-danger" onClick={async () => {
              if (!confirmRetire) { setConfirmRetire(true); return }
              await window.api.tires.retireSet(active.id, todayISO(), odometer)
              toast.success('Set retired')
              setConfirmRetire(false); load(); onChanged()
            }}>{confirmRetire ? 'Retire — click again' : 'Retire this set'}</button>
          </>
        ) : (
          <button className="dl-save" onClick={() => setEditing('new')}>+ Fit a set</button>
        )}
      </div>

      {active && (
        <div className="dl-btnrow">
          <button className="dl-save dl-ghost" onClick={() => setEditing('new')}>+ Fit a different set</button>
        </div>
      )}

      {retired.length > 0 && (
        <>
          <h3 className="dl-subhead">RETIRED</h3>
          {retired.map(s => (
            <div key={s.id} className="dl-setrow">
              <span className="dl-lab">
                <b>{s.brand} {s.model}</b>
                <span className="mono">
                  {s.size} · {formatDate(s.install_date)} → {s.retired_date ? formatDate(s.retired_date) : '—'}
                  {s.retired_odometer != null ? ` · ${(s.retired_odometer - s.install_odometer).toLocaleString()} ${distanceUnit}` : ''}
                </span>
              </span>
            </div>
          ))}
        </>
      )}
      <p className="dl-microcopy">Fitting a new set doesn't retire the old one — retire it first if it came off</p>
    </>
  )
}

function TireSetForm({ set: existing, distanceUnit, odometer, onSaved, onCancel }: {
  set: TireSet | null; distanceUnit: string; odometer: number
  onSaved: () => void; onCancel: () => void
}) {
  const [f, setF] = useState<Record<string, string>>(() => ({
    brand: existing?.brand ?? '',
    model: existing?.model ?? '',
    size: existing?.size ?? '',
    installDate: existing?.install_date ?? todayISO(),
    installOdo: existing ? String(existing.install_odometer) : String(odometer),
    dot: existing?.dot_date ?? '',
    psiF: existing?.recommended_psi_front != null ? String(existing.recommended_psi_front) : '',
    psiR: existing?.recommended_psi_rear != null ? String(existing.recommended_psi_rear) : '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (v: string) => setF(prev => ({ ...prev, [k]: v }))
  const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null }

  async function save() {
    const e: Record<string, string> = {}
    if (!f.brand.trim()) e.brand = 'Required'
    if (!f.size.trim()) e.size = 'e.g. 265/65R17'
    if (!f.installDate) e.installDate = 'Pick a date'
    const installOdo = parseFloat(f.installOdo)
    if (!Number.isFinite(installOdo) || installOdo < 0) e.installOdo = 'Enter a reading'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    const payload = {
      brand: f.brand.trim(), model: f.model.trim(), size: f.size.trim(),
      dot_date: f.dot.trim() || null,
      install_date: f.installDate, install_odometer: installOdo,
      retired_date: null, retired_odometer: null,
      recommended_psi_front: num(f.psiF), recommended_psi_rear: num(f.psiR),
      notes: null,
    }
    try {
      if (existing) {
        await window.api.tires.updateSet(existing.id, payload)
        toast.success('Set updated')
      } else {
        await window.api.tires.addSet(payload)
        toast.success('Set fitted')
      }
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="dl-frow">
        <Field id="ts-brand" label="Brand" value={f.brand} onChange={set('brand')} error={errors.brand} placeholder="Bridgestone" mono={false} />
        <Field id="ts-model" label="Model" value={f.model} onChange={set('model')} placeholder="Dueler A/T" mono={false} />
      </div>
      <div className="dl-frow">
        <Field id="ts-size" label="Size" value={f.size} onChange={set('size')} error={errors.size} placeholder="265/65R17" />
        <Field id="ts-dot" label="DOT date" value={f.dot} onChange={set('dot')} placeholder="yyyy-mm" hint="week/year stamped on the wall" />
      </div>
      <div className="dl-frow">
        <Field id="ts-date" label="Fitted on" value={f.installDate} onChange={set('installDate')} error={errors.installDate} placeholder="yyyy-mm-dd" />
        <Field
          id="ts-odo" label={`Fitted at (${distanceUnit})`} value={f.installOdo}
          onChange={set('installOdo')} error={errors.installOdo}
          hint="distance on the set counts from here"
        />
      </div>
      <div className="dl-frow">
        <Field id="ts-psif" label="Front PSI" value={f.psiF} onChange={set('psiF')} placeholder="optional" />
        <Field id="ts-psir" label="Rear PSI" value={f.psiR} onChange={set('psiR')} placeholder="optional" />
      </div>
      <div className="dl-btnrow">
        <button className="dl-save" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Fit set'}
        </button>
        <button className="dl-save dl-ghost" onClick={onCancel}>Back</button>
      </div>
    </>
  )
}
