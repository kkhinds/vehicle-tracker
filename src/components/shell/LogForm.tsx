import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { todayISO } from '@/lib/utils'
import { PhotoPicker } from './Photos'
import type { EntryKind } from '@/env'

export type LogType = 'fuel' | 'service' | 'fluid' | 'tires' | 'insurance' | 'docs'

const TYPES: { key: LogType; label: string }[] = [
  { key: 'fuel', label: 'Fuel' }, { key: 'service', label: 'Service' },
  { key: 'fluid', label: 'Fluid' }, { key: 'tires', label: 'Tires' },
  { key: 'insurance', label: 'Insurance' }, { key: 'docs', label: 'Doc' },
]

/** An existing record opened for editing, loaded by the shell. */
export interface EditTarget {
  type: LogType
  id: number
  record: Record<string, unknown>
}

interface LogFormProps {
  initialType: LogType
  odometer: number
  distanceUnit: string
  /** Station and price carried over from the last fill-up, so the weekly job is fast. */
  lastFuel: { station: string | null; pricePerLitre: number | null } | null
  /** Set to edit an existing record instead of adding a new one. */
  edit?: EditTarget | null
  /** The vehicle's running economy, used to flag a suspiciously good tank. */
  avgConsumption?: number | null
  onSaved: (what: string) => void
  onCancel: () => void
}

type Errors = Partial<Record<string, string>>

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** Photo folder each type files its attachments under. */
const PHOTO_CATEGORY: Record<LogType, string> = {
  fuel: 'fuel', service: 'maintenance', fluid: 'maintenance',
  tires: 'tires', insurance: 'insurance', docs: 'documents',
}

/** Fluids carry no attachment column, so they get no picker. */
const TAKES_PHOTOS: Record<LogType, boolean> = {
  fuel: true, service: true, fluid: false, tires: true, insurance: true, docs: true,
}

/** Fuel receipts and tire inspection shots are single columns, not tables. */
const SINGLE_PHOTO: Record<string, boolean> = { fuel: true, tires: true }

function recordToPhotos(type: LogType, r: Record<string, unknown>): string[] {
  if (type === 'fuel') return r.receipt_photo ? [String(r.receipt_photo)] : []
  if (type === 'tires') return r.photo ? [String(r.photo)] : []
  return Array.isArray(r.photos) ? (r.photos as string[]) : []
}

/** Inverse of the payloads in save() — turns a stored record back into fields. */
function recordToForm(type: LogType, r: Record<string, unknown>): Record<string, string> {
  switch (type) {
    case 'fuel': return {
      date: str(r.date), odometer: str(r.odometer), litres: str(r.litres),
      price: str(r.cost_per_litre), total: str(r.total_cost), totalTouched: '1',
      station: str(r.fuel_station), notes: str(r.notes),
      missed: r.missed_fills ? '1' : '',
    }
    case 'service': return {
      date: str(r.date), odometer: str(r.odometer), category: str(r.category),
      description: str(r.description), cost: str(r.cost), shop: str(r.shop_name),
      notes: str(r.notes),
    }
    case 'fluid': return {
      date: str(r.date), odometer: str(r.odometer), fluidType: str(r.fluid_type),
      amount: str(r.amount), unit: str(r.unit), notes: str(r.notes),
    }
    case 'insurance': return {
      date: str(r.start_date), provider: str(r.provider), policy: str(r.policy_number),
      coverage: str(r.coverage_type), premium: str(r.premium_amount),
      renewal: str(r.renewal_date), notes: str(r.notes),
      active: r.is_active === false ? '' : '1',
    }
    case 'docs': return {
      date: str(r.issued_date), title: str(r.title), docType: str(r.doc_type),
      expiry: str(r.expiry_date), noExpiry: r.expiry_date ? '' : '1',
      cost: str(r.cost), notes: str(r.notes),
    }
    default: return {}
  }
}

export default function LogForm({
  initialType, odometer, distanceUnit, lastFuel, edit, avgConsumption, onSaved, onCancel,
}: LogFormProps) {
  const [type, setType] = useState<LogType>(edit?.type ?? initialType)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [f, setF] = useState<Record<string, string>>({})
  const [fullTank, setFullTank] = useState(true)
  const [photos, setPhotos] = useState<string[]>([])
  /** Tires log two different things against the fitted set. */
  const [tireMode, setTireMode] = useState<'inspection' | 'rotation'>('inspection')
  const [fluidPresets, setFluidPresets] = useState<{ key: string; label: string }[]>([])
  // Picking copies the file immediately, so anything picked and then abandoned
  // has to be unlinked or it sits in the photos folder forever.
  const copied = useRef<string[]>([])

  useEffect(() => { setType(edit?.type ?? initialType) }, [initialType, edit])

  // Reset per type, seeding the values worth pre-filling. Editing seeds from
  // the stored record instead, and the type is fixed.
  useEffect(() => {
    setErrors({})
    if (edit) {
      setF(recordToForm(edit.type, edit.record))
      setFullTank(edit.record.full_tank !== false)
      setPhotos(recordToPhotos(edit.type, edit.record))
      return
    }
    setF({
      date: todayISO(),
      odometer: '',
      station: lastFuel?.station ?? '',
      price: lastFuel?.pricePerLitre != null ? String(lastFuel.pricePerLitre) : '',
    })
    setFullTank(true)
    setPhotos([])
  }, [type, lastFuel, edit])

  useEffect(() => {
    if (type !== 'fluid' || fluidPresets.length) return
    window.api.fluids.getPresets().then(p => setFluidPresets(p.map(x => ({ key: x.key, label: x.label }))))
  }, [type, fluidPresets.length])

  /** Drops copies the user picked but never saved. */
  async function cancel() {
    const saved = new Set(edit ? recordToPhotos(edit.type, edit.record) : [])
    for (const p of copied.current) {
      if (!saved.has(p)) await window.api.files.deleteFile(p)
    }
    copied.current = []
    onCancel()
  }

  function changePhotos(next: string[]) {
    for (const p of next) if (!copied.current.includes(p)) copied.current.push(p)
    setPhotos(next)
  }

  const set = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }))

  // Total follows litres × price unless it has been typed over.
  const autoTotal = useMemo(() => {
    const l = parseFloat(f.litres ?? ''), p = parseFloat(f.price ?? '')
    return Number.isFinite(l) && Number.isFinite(p) ? (l * p).toFixed(2) : ''
  }, [f.litres, f.price])
  const totalValue = f.totalTouched === '1' ? (f.total ?? '') : autoTotal

  function validate(): Errors {
    const e: Errors = {}
    const needsOdo = type === 'fuel' || type === 'service' || type === 'fluid' || type === 'tires'
    if (needsOdo) {
      const v = parseFloat(f.odometer ?? '')
      if (!Number.isFinite(v)) e.odometer = 'Enter the current reading'
      // Readings only go up; a lower one would poison economy and service maths.
      // An edit is exempt — an older entry legitimately sits below today's reading.
      else if (!edit && v < odometer) e.odometer = `Must be at least ${odometer.toLocaleString()} ${distanceUnit}`
      else if (v < 0) e.odometer = 'Cannot be negative'
    }
    if (!f.date) e.date = 'Pick a date'
    if (type === 'fuel') {
      if (!(parseFloat(f.litres ?? '') > 0)) e.litres = 'Litres are required'
      if (!(parseFloat(totalValue) > 0)) e.total = 'Total is required'
    }
    if (type === 'service' && !f.description?.trim()) e.description = 'Describe the work'
    if (type === 'fluid' && !(parseFloat(f.amount ?? '') > 0)) e.amount = 'Amount is required'
    if (type === 'insurance') {
      if (!f.provider?.trim()) e.provider = 'Provider is required'
      if (!f.renewal) e.renewal = 'Renewal date is required'
    }
    if (type === 'docs' && !f.title?.trim()) e.title = 'Title is required'
    return e
  }

  async function save() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    const odo = parseFloat(f.odometer ?? '')
    try {
      if (edit) { await saveEdit(odo); return }
      switch (type) {
        case 'fuel': {
          const litres = parseFloat(f.litres), total = parseFloat(totalValue)
          const saved = await window.api.fuel.add({
            date: f.date, odometer: odo, litres,
            cost_per_litre: parseFloat(f.price) || +(total / litres).toFixed(3),
            total_cost: total, fuel_station: f.station || null,
            full_tank: fullTank, notes: f.notes || null, receipt_photo: photos[0] ?? null,
            missed_fills: f.missed === '1',
            // Derived by the backend from the fill-to-full span, not the form.
            consumption: null,
          })
          onSaved('Fill-up saved')
          // A tank that reads far better than this vehicle ever manages almost
          // always means a fill-up went unlogged, not a sudden miracle.
          if (avgConsumption && saved.consumption && saved.consumption > avgConsumption * 1.75) {
            toast.warning(
              'That tank came out much better than usual — if you missed logging a fill-up, ' +
              'open the entry and tick "I missed logging fill-ups before this one".',
              { duration: 9000 },
            )
          }
          break
        }
        case 'service':
          await window.api.maintenance.add({
            date: f.date, odometer: odo, category: f.category || 'Other',
            description: f.description, cost: parseFloat(f.cost ?? '') || 0,
            shop_name: f.shop || null, parts_replaced: null,
            notes: f.notes || null, photos,
          })
          onSaved('Service logged'); break
        case 'fluid':
          await window.api.fluids.add({
            date: f.date, odometer: odo, fluid_type: f.fluidType || 'engine-oil',
            amount: parseFloat(f.amount), unit: (f.unit as 'ml' | 'L' | 'oz') || 'ml',
            notes: f.notes || null,
          })
          onSaved('Top-up logged'); break
        case 'tires': {
          const sets = await window.api.tires.getSets()
          const active = sets.find(s => s.is_active) ?? sets[0]
          if (!active) { toast.error('Fit a tire set first — Tires lens › Tire set'); break }
          if (tireMode === 'rotation') {
            await window.api.tires.addRotation({
              tire_set_id: active.id, date: f.date, odometer: odo,
              pattern: (f.pattern as never) || 'front-to-back', notes: f.notes || null,
            })
            onSaved('Rotation logged'); break
          }
          const mm = (k: string) => { const n = parseFloat(f[k] ?? ''); return Number.isFinite(n) ? n : null }
          await window.api.tires.addInspection({
            tire_set_id: active.id, date: f.date, odometer: odo,
            tread_fl: mm('fl'), tread_fr: mm('fr'), tread_rl: mm('rl'), tread_rr: mm('rr'),
            pressure_fl: null, pressure_fr: null, pressure_rl: null, pressure_rr: null,
            notes: f.notes || null, photo: photos[0] ?? null,
          })
          onSaved('Inspection logged'); break
        }
        case 'insurance':
          await window.api.insurance.add({
            provider: f.provider, policy_number: f.policy || '',
            coverage_type: (f.coverage as never) || 'comprehensive',
            premium_amount: parseFloat(f.premium ?? '') || 0,
            payment_frequency: 'annually', start_date: f.date, renewal_date: f.renewal,
            agent_name: null, agent_contact: null, notes: f.notes || null,
            is_active: true, photos,
          })
          onSaved('Policy saved'); break
        case 'docs':
          await window.api.documents.add({
            doc_type: (f.docType as never) || 'registration', title: f.title,
            reference_number: null, issuer: null, issued_date: f.date,
            expiry_date: f.noExpiry === '1' ? null : (f.expiry || null),
            cost: parseFloat(f.cost ?? '') || null, notes: f.notes || null, photos,
          })
          onSaved('Document saved'); break
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /** Updates send only the fields this form owns; handlers merge the rest. */
  async function saveEdit(odo: number) {
    if (!edit) return
    const id = edit.id
    switch (edit.type) {
      case 'fuel': {
        const litres = parseFloat(f.litres), total = parseFloat(totalValue)
        await window.api.fuel.update(id, {
          date: f.date, odometer: odo, litres,
          cost_per_litre: parseFloat(f.price) || +(total / litres).toFixed(3),
          total_cost: total, fuel_station: f.station || null,
          full_tank: fullTank, notes: f.notes || null,
          receipt_photo: photos[0] ?? null,
          missed_fills: f.missed === '1',
        })
        onSaved('Fill-up updated'); break
      }
      case 'service':
        await window.api.maintenance.update(id, {
          date: f.date, odometer: odo, category: f.category || 'Other',
          description: f.description, cost: parseFloat(f.cost ?? '') || 0,
          shop_name: f.shop || null, notes: f.notes || null, photos,
        })
        onSaved('Service updated'); break
      case 'fluid':
        await window.api.fluids.update(id, {
          date: f.date, odometer: odo, fluid_type: f.fluidType || 'engine-oil',
          amount: parseFloat(f.amount), unit: (f.unit as 'ml' | 'L' | 'oz') || 'ml',
          notes: f.notes || null,
        })
        onSaved('Top-up updated'); break
      case 'insurance':
        await window.api.insurance.update(id, {
          provider: f.provider, policy_number: f.policy || '',
          coverage_type: (f.coverage as never) || 'comprehensive',
          premium_amount: parseFloat(f.premium ?? '') || 0,
          start_date: f.date, renewal_date: f.renewal, notes: f.notes || null, photos,
          is_active: f.active === '1',
        })
        onSaved('Policy updated'); break
      case 'docs':
        await window.api.documents.update(id, {
          doc_type: (f.docType as never) || 'registration', title: f.title,
          issued_date: f.date, expiry_date: f.noExpiry === '1' ? null : (f.expiry || null),
          cost: parseFloat(f.cost ?? '') || null, notes: f.notes || null, photos,
        })
        onSaved('Document updated'); break
      default:
        toast.error('This record type can only be deleted, not edited')
    }
  }

  const field = (
    name: string, label: string,
    opts: { type?: string; placeholder?: string; hint?: string; value?: string; list?: string } = {}
  ) => (
    <div className={`dl-field${errors[name] ? ' error' : ''}`}>
      <label htmlFor={`lf-${name}`}>{label}</label>
      <input
        id={`lf-${name}`}
        className={opts.type === 'text' ? '' : 'mono'}
        inputMode={opts.type === 'text' ? undefined : 'decimal'}
        placeholder={opts.placeholder}
        list={opts.list}
        value={opts.value ?? f[name] ?? ''}
        onChange={e => {
          if (name === 'total') set('totalTouched', '1')
          set(name, e.target.value)
        }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
      />
      {errors[name]
        ? <div className="dl-err">{errors[name]}</div>
        : opts.hint && <div className="dl-hint">{opts.hint}</div>}
    </div>
  )

  return (
    <>
      {/* A record can't change type mid-edit — the row lives in one table. */}
      {!edit && (
        <div className="dl-seg" role="group" aria-label="Record type">
          {TYPES.map(t => (
            <button key={t.key} aria-pressed={type === t.key} onClick={() => setType(t.key)}>{t.label}</button>
          ))}
        </div>
      )}

      {(type === 'fuel' || type === 'service' || type === 'fluid' || type === 'tires') && (
        <div className="dl-frow">
          {field('odometer', `Odometer (${distanceUnit})`, {
            placeholder: `last: ${odometer.toLocaleString()}`,
            hint: edit ? 'the reading when this happened' : `must be ≥ ${odometer.toLocaleString()}`,
          })}
          {field('date', 'Date', { type: 'text' })}
        </div>
      )}

      {type === 'fuel' && (
        <>
          <div className="dl-frow">
            {field('litres', 'Litres', { placeholder: '0.0' })}
            {field('price', 'Price / L')}
            {field('total', 'Total', { placeholder: 'auto', hint: 'litres × price — editable', value: totalValue })}
          </div>
          <div className="dl-frow">
            {field('station', 'Station', { type: 'text', hint: lastFuel?.station ? 'from your last fill-up' : undefined })}
            <div className="dl-field">
              <label>Tank</label>
              <div className="dl-seg" style={{ margin: 0 }} role="group" aria-label="Tank">
                <button aria-pressed={fullTank} onClick={() => setFullTank(true)}>Full</button>
                <button aria-pressed={!fullTank} onClick={() => setFullTank(false)}>Partial</button>
              </div>
              <div className="dl-hint">full tanks drive the economy figure</div>
            </div>
          </div>
          <label className="dl-check">
            <input
              type="checkbox"
              checked={f.missed === '1'}
              onChange={e => set('missed', e.target.checked ? '1' : '')}
            />
            I missed logging fill-ups before this one
          </label>
          {f.missed === '1' && (
            <div className="dl-hint">
              The distance since your last logged fill covers fuel that was never recorded, so
              economy skips this tank and starts measuring again from here.
            </div>
          )}
        </>
      )}

      {type === 'service' && (
        <>
          {field('description', 'What was done', { type: 'text', placeholder: 'Oil and filter change' })}
          <div className="dl-frow">
            {field('cost', 'Cost', { placeholder: '0.00' })}
            {field('shop', 'Shop', { type: 'text', placeholder: 'Optional' })}
          </div>
        </>
      )}

      {type === 'fluid' && (
        <>
          <div className="dl-frow">
            {field('fluidType', 'Fluid', { type: 'text', placeholder: 'engine-oil', list: 'lf-fluid-list' })}
            {field('amount', 'Amount', { placeholder: '0' })}
            {field('unit', 'Unit', { type: 'text', placeholder: 'ml' })}
          </div>
          {/* Suggestions only — a fluid the presets don't know about still types in. */}
          <datalist id="lf-fluid-list">
            {fluidPresets.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </datalist>
        </>
      )}

      {type === 'tires' && (
        <>
          {!edit && (
            <div className="dl-seg" role="group" aria-label="Tire record">
              <button aria-pressed={tireMode === 'inspection'} onClick={() => setTireMode('inspection')}>Inspection</button>
              <button aria-pressed={tireMode === 'rotation'} onClick={() => setTireMode('rotation')}>Rotation</button>
            </div>
          )}
          {tireMode === 'rotation' ? (
            <>
              {field('pattern', 'Pattern', {
                type: 'text', placeholder: 'front-to-back', list: 'lf-pattern-list',
                hint: 'how the wheels moved around',
              })}
              <datalist id="lf-pattern-list">
                {['front-to-back', 'cross', 'x-pattern', 'side-to-side', 'other'].map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </>
          ) : (
            <>
              <div className="dl-hint" style={{ marginTop: 12 }}>Tread depth per corner (mm) — leave blank if not measured</div>
              <div className="dl-frow">
                {field('fl', 'Front left')}{field('fr', 'Front right')}
                {field('rl', 'Rear left')}{field('rr', 'Rear right')}
              </div>
            </>
          )}
        </>
      )}

      {type === 'insurance' && (
        <>
          <div className="dl-frow">
            {field('provider', 'Provider', { type: 'text' })}
            {field('policy', 'Policy number', { type: 'text' })}
          </div>
          <div className="dl-frow">
            {field('premium', 'Premium', { placeholder: '0.00' })}
            {field('date', 'Starts', { type: 'text' })}
            {field('renewal', 'Renews', { type: 'text', placeholder: 'yyyy-mm-dd' })}
          </div>
          {edit && (
            <label className="dl-check">
              <input
                type="checkbox"
                checked={f.active === '1'}
                onChange={e => set('active', e.target.checked ? '1' : '')}
              />
              Still the active policy — renewal reminders come off this
            </label>
          )}
        </>
      )}

      {type === 'docs' && (
        <>
          <div className="dl-frow">
            {field('title', 'Title', { type: 'text', placeholder: 'Road tax' })}
            {field('docType', 'Type', { type: 'text', placeholder: 'registration' })}
          </div>
          <div className="dl-frow">
            {field('expiry', 'Expires', { type: 'text', placeholder: 'yyyy-mm-dd' })}
            {field('cost', 'Cost', { placeholder: '0.00' })}
          </div>
          <label className="dl-check">
            <input
              type="checkbox"
              checked={f.noExpiry === '1'}
              onChange={e => set('noExpiry', e.target.checked ? '1' : '')}
            />
            Doesn't expire
          </label>
        </>
      )}

      {TAKES_PHOTOS[type] && !(type === 'tires' && tireMode === 'rotation') && (
        <PhotoPicker
          category={PHOTO_CATEGORY[type]}
          paths={photos}
          onChange={changePhotos}
          multiple={!SINGLE_PHOTO[type]}
          label={type === 'fuel' ? 'Receipt' : 'File'}
        />
      )}

      <div className="dl-btnrow">
        <button className="dl-save" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : edit ? 'Save changes' : 'Save'}
          <span className="mono" style={{ fontWeight: 400 }}> · Enter</span>
        </button>
        <button className="dl-save dl-ghost" onClick={cancel}>Cancel</button>
      </div>
    </>
  )
}

export const KIND_TO_LOG: Record<EntryKind, LogType> = {
  fuel: 'fuel', service: 'service', fluid: 'fluid', tires: 'tires',
  insurance: 'insurance', docs: 'docs',
}
