import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { daysUntil, addMonthsISO } from '../dates'
import { format, addDays, parseISO, differenceInDays } from 'date-fns'

/**
 * The Driver's Log spine: one chronological feed of everything that happened to
 * a vehicle, plus the road ahead (what is coming, projected onto dates).
 *
 * Date is the primary axis — every record has one — and the odometer rides along
 * as an annotation, because only some records carry a reading.
 */

export type EntryKind = 'fuel' | 'service' | 'tires' | 'fluid' | 'insurance' | 'docs'

export interface TimelineEntry {
  id: string            // "<kind>:<row id>" — rows share ids across tables
  kind: EntryKind
  date: string          // yyyy-MM-dd
  odometer: number | null
  title: string
  subtitle: string
  value: string | null      // right-hand figure, already formatted
  valueSub: string | null   // smaller line under it
}

export interface AheadItem {
  id: string
  kind: EntryKind
  title: string
  subtitle: string
  dueDate: string | null       // real deadline for date-based items
  projectedDate: string | null // where it lands on the spine (estimated for km-based)
  estimated: boolean
  dueKm: number | null
  kmRemaining: number | null
  daysRemaining: number | null
  status: 'ok' | 'due-soon' | 'overdue'
}

type Db = ReturnType<typeof getDb>

/**
 * Average km/day from the vehicle's own logged readings. Used to project a date
 * onto distance-based service intervals. Null when there isn't enough history —
 * callers then show the km figure alone rather than inventing a date.
 */
function drivingRatePerDay(db: Db, vehicleId: number): number | null {
  const row = db.prepare(`
    SELECT MIN(date) AS first_date, MAX(date) AS last_date,
           MIN(odometer) AS first_odo, MAX(odometer) AS last_odo, COUNT(*) AS n
      FROM (
        SELECT date, odometer FROM fuel_log WHERE vehicle_id = @v
        UNION ALL SELECT date, odometer FROM maintenance_log WHERE vehicle_id = @v
        UNION ALL SELECT date, odometer FROM fluid_topups WHERE vehicle_id = @v
      )
  `).get<{ first_date: string; last_date: string; first_odo: number; last_odo: number; n: number }>({ v: vehicleId })

  if (!row || row.n < 2 || !row.first_date || !row.last_date) return null
  const days = differenceInDays(parseISO(row.last_date), parseISO(row.first_date))
  const km = row.last_odo - row.first_odo
  if (days < 14 || km <= 0) return null   // too little history to extrapolate
  return km / days
}

function money(n: number | null | undefined): string | null {
  return n == null ? null : `$${n.toFixed(2)}`
}

export function registerTimelineHandlers(): void {
  const db = getDb()

  ipcMain.handle('timeline:getEntries', () => {
    const v = getCurrentVehicleId()
    const out: TimelineEntry[] = []

    for (const r of db.prepare(
      'SELECT id, date, odometer, litres, cost_per_litre, total_cost, fuel_station, full_tank, consumption FROM fuel_log WHERE vehicle_id = ?'
    ).all<{ id: number; date: string; odometer: number; litres: number; cost_per_litre: number; total_cost: number; fuel_station: string | null; full_tank: number; consumption: number | null }>(v)) {
      out.push({
        id: `fuel:${r.id}`, kind: 'fuel', date: r.date, odometer: r.odometer,
        title: `Fill-up${r.fuel_station ? ` — ${r.fuel_station}` : ''}`,
        subtitle: `${r.litres.toFixed(1)} L @ $${r.cost_per_litre.toFixed(2)}/L · ${r.full_tank ? 'full tank' : 'partial'}`,
        value: money(r.total_cost),
        valueSub: r.consumption ? `${r.consumption.toFixed(1)} km/L` : null,
      })
    }

    for (const r of db.prepare(
      'SELECT id, date, odometer, category, description, cost, shop_name FROM maintenance_log WHERE vehicle_id = ?'
    ).all<{ id: number; date: string; odometer: number; category: string; description: string; cost: number; shop_name: string | null }>(v)) {
      out.push({
        id: `service:${r.id}`, kind: 'service', date: r.date, odometer: r.odometer,
        title: r.description || r.category,
        subtitle: [r.category, r.shop_name].filter(Boolean).join(' · '),
        value: money(r.cost), valueSub: null,
      })
    }

    for (const r of db.prepare(
      'SELECT id, date, odometer, fluid_type, amount, unit FROM fluid_topups WHERE vehicle_id = ?'
    ).all<{ id: number; date: string; odometer: number; fluid_type: string; amount: number; unit: string }>(v)) {
      out.push({
        id: `fluid:${r.id}`, kind: 'fluid', date: r.date, odometer: r.odometer,
        title: `${r.fluid_type.replace(/-/g, ' ')} top-up`,
        subtitle: `${r.amount} ${r.unit}`,
        value: `${r.amount}`, valueSub: r.unit,
      })
    }

    for (const r of db.prepare(`
      SELECT ti.id, ti.date, ti.odometer, ti.tread_fl, ti.tread_fr, ti.tread_rl, ti.tread_rr, ts.brand, ts.model
        FROM tire_inspections ti JOIN tire_sets ts ON ti.tire_set_id = ts.id
       WHERE ts.vehicle_id = ?`
    ).all<{ id: number; date: string; odometer: number; tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null; brand: string; model: string }>(v)) {
      const treads = [r.tread_fl, r.tread_fr, r.tread_rl, r.tread_rr].filter((t): t is number => t != null)
      out.push({
        id: `tires:${r.id}`, kind: 'tires', date: r.date, odometer: r.odometer,
        title: 'Tire inspection',
        subtitle: `${r.brand} ${r.model}${treads.length ? ` · tread ${treads.join(' / ')} mm` : ''}`,
        value: treads.length ? `${Math.min(...treads)}` : null,
        valueSub: treads.length ? 'mm min' : null,
      })
    }

    for (const r of db.prepare(`
      SELECT tr.id, tr.date, tr.odometer, tr.pattern FROM tire_rotations tr
        JOIN tire_sets ts ON tr.tire_set_id = ts.id WHERE ts.vehicle_id = ?`
    ).all<{ id: number; date: string; odometer: number; pattern: string }>(v)) {
      out.push({
        id: `rotation:${r.id}`, kind: 'tires', date: r.date, odometer: r.odometer,
        title: 'Tire rotation', subtitle: r.pattern.replace(/-/g, ' '),
        value: null, valueSub: null,
      })
    }

    for (const r of db.prepare(
      'SELECT id, install_date, install_odometer, brand, model, size FROM tire_sets WHERE vehicle_id = ?'
    ).all<{ id: number; install_date: string; install_odometer: number; brand: string; model: string; size: string }>(v)) {
      out.push({
        id: `tireset:${r.id}`, kind: 'tires', date: r.install_date, odometer: r.install_odometer,
        title: `New tires fitted — ${r.brand} ${r.model}`, subtitle: r.size,
        value: null, valueSub: null,
      })
    }

    for (const r of db.prepare(
      'SELECT id, provider, policy_number, premium_amount, start_date FROM insurance_policies WHERE vehicle_id = ?'
    ).all<{ id: number; provider: string; policy_number: string; premium_amount: number; start_date: string }>(v)) {
      out.push({
        id: `insurance:${r.id}`, kind: 'insurance', date: r.start_date, odometer: null,
        title: `Policy started — ${r.provider}`, subtitle: r.policy_number,
        value: money(r.premium_amount), valueSub: null,
      })
    }

    for (const r of db.prepare(
      'SELECT id, doc_type, title, issued_date, expiry_date, cost FROM vehicle_documents WHERE vehicle_id = ?'
    ).all<{ id: number; doc_type: string; title: string; issued_date: string | null; expiry_date: string | null; cost: number | null }>(v)) {
      const when = r.issued_date ?? r.expiry_date
      if (!when) continue
      out.push({
        id: `docs:${r.id}`, kind: 'docs', date: when, odometer: null,
        title: r.title, subtitle: r.doc_type.replace(/-/g, ' '),
        value: money(r.cost), valueSub: null,
      })
    }

    // Newest first; odometer breaks ties so same-day rows read in driving order.
    out.sort((a, b) =>
      b.date.localeCompare(a.date) || (b.odometer ?? 0) - (a.odometer ?? 0)
    )
    return out
  })

  ipcMain.handle('timeline:getAhead', () => {
    const v = getCurrentVehicleId()
    const odo = db.prepare('SELECT current_odometer FROM vehicles WHERE id = ?')
      .get<{ current_odometer: number }>(v)?.current_odometer ?? 0
    const rate = drivingRatePerDay(db, v)
    const items: AheadItem[] = []

    for (const iv of db.prepare(
      'SELECT id, name, interval_km, interval_months, last_done_km, last_done_date FROM service_intervals WHERE vehicle_id = ?'
    ).all<{ id: number; name: string; interval_km: number; interval_months: number | null; last_done_km: number | null; last_done_date: string | null }>(v)) {
      const dueKm = (iv.last_done_km ?? 0) + iv.interval_km
      const kmRemaining = dueKm - odo
      const dueDate = iv.interval_months && iv.last_done_date
        ? addMonthsISO(iv.last_done_date, iv.interval_months)
        : null
      const daysRemaining = dueDate ? daysUntil(dueDate) : null

      // Project the distance deadline onto a date so it can sit on the spine.
      const kmDate = rate && kmRemaining > 0
        ? format(addDays(new Date(), kmRemaining / rate), 'yyyy-MM-dd')
        : null
      // Whichever deadline arrives first is the one shown.
      const projectedDate = dueDate && kmDate ? (dueDate < kmDate ? dueDate : kmDate) : (dueDate ?? kmDate)
      const estimated = projectedDate != null && projectedDate === kmDate && dueDate !== kmDate

      const kmStatus = kmRemaining <= 0 ? 'overdue' : kmRemaining <= 1000 ? 'due-soon' : 'ok'
      const dateStatus = daysRemaining == null ? 'ok' : daysRemaining <= 0 ? 'overdue' : daysRemaining <= 30 ? 'due-soon' : 'ok'
      const rank = { ok: 0, 'due-soon': 1, overdue: 2 } as const
      const status = rank[dateStatus] > rank[kmStatus] ? dateStatus : kmStatus

      items.push({
        id: `service:${iv.id}`, kind: 'service', title: iv.name,
        subtitle: [
          kmRemaining > 0 ? `in ${Math.round(kmRemaining).toLocaleString()} km` : `${Math.abs(Math.round(kmRemaining)).toLocaleString()} km overdue`,
          dueDate ? `or ${format(parseISO(dueDate), 'd MMM yyyy')}, whichever first` : null,
        ].filter(Boolean).join(' — '),
        dueDate, projectedDate, estimated, dueKm, kmRemaining, daysRemaining, status,
      })
    }

    for (const d of db.prepare(
      'SELECT id, title, doc_type, expiry_date FROM vehicle_documents WHERE vehicle_id = ? AND expiry_date IS NOT NULL'
    ).all<{ id: number; title: string; doc_type: string; expiry_date: string }>(v)) {
      const days = daysUntil(d.expiry_date)
      items.push({
        id: `docs:${d.id}`, kind: 'docs', title: `${d.title} renewal`,
        subtitle: `expires ${format(parseISO(d.expiry_date), 'd MMM yyyy')} · ${d.doc_type.replace(/-/g, ' ')}`,
        dueDate: d.expiry_date, projectedDate: d.expiry_date, estimated: false,
        dueKm: null, kmRemaining: null, daysRemaining: days,
        status: days <= 0 ? 'overdue' : days <= 30 ? 'due-soon' : 'ok',
      })
    }

    for (const p of db.prepare(
      'SELECT id, provider, renewal_date FROM insurance_policies WHERE vehicle_id = ? AND is_active = 1'
    ).all<{ id: number; provider: string; renewal_date: string }>(v)) {
      const days = daysUntil(p.renewal_date)
      items.push({
        id: `insurance:${p.id}`, kind: 'insurance', title: `${p.provider} renewal`,
        subtitle: `policy renews ${format(parseISO(p.renewal_date), 'd MMM yyyy')}`,
        dueDate: p.renewal_date, projectedDate: p.renewal_date, estimated: false,
        dueKm: null, kmRemaining: null, daysRemaining: days,
        status: days <= 0 ? 'overdue' : days <= 30 ? 'due-soon' : 'ok',
      })
    }

    // Soonest last: the spine runs far-future at the top down to TODAY.
    items.sort((a, b) => {
      const ad = a.projectedDate ?? '9999-12-31', bd = b.projectedDate ?? '9999-12-31'
      return bd.localeCompare(ad)
    })
    return { items, ratePerDay: rate }
  })
}
