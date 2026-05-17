import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import type { ActivityEntry, MonthlyTrendEntry, DocumentType } from '../../../src/types'

interface SumRow { total: number | null }
interface AvgRow { avg: number | null }
interface ActivityRow { id: number; date: string; description: string; amount: number }
interface VehicleOdoRow { current_odometer: number }

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function registerDashboardHandlers(): void {
  const db = getDb()

  ipcMain.handle('dashboard:getSummary', () => {
    const vehicleId = getCurrentVehicleId()
    const now = new Date()
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

    // Monthly fuel cost
    const fuelMonth = db.prepare(
      "SELECT SUM(total_cost) as total FROM fuel_log WHERE vehicle_id = ? AND date >= ? AND date <= ?"
    ).get(vehicleId, monthStart, monthEnd) as SumRow
    const monthlyFuelCost = fuelMonth.total ?? 0

    // Average consumption
    const avgRow = db.prepare(
      "SELECT AVG(consumption) as avg FROM fuel_log WHERE vehicle_id = ? AND consumption IS NOT NULL AND full_tank = 1"
    ).get(vehicleId) as AvgRow
    const avgConsumption = avgRow.avg ?? null

    // Vehicle odometer (single source of truth)
    const odoRow = db.prepare(
      'SELECT current_odometer FROM vehicles WHERE id = ?'
    ).get(vehicleId) as VehicleOdoRow | undefined
    const odometer = odoRow?.current_odometer ?? 0

    // Next service due
    const intervals = db.prepare(
      'SELECT * FROM service_intervals WHERE vehicle_id = ? ORDER BY interval_km ASC'
    ).all(vehicleId) as Array<{
      id: number; name: string; interval_km: number; last_done_km: number | null
    }>

    let nextService = null
    let minRemaining = Infinity
    for (const interval of intervals) {
      const dueKm = (interval.last_done_km ?? 0) + interval.interval_km
      const remaining = dueKm - odometer
      if (remaining < minRemaining) {
        minRemaining = remaining
        nextService = { name: interval.name, kmRemaining: Math.round(remaining), dueKm }
      }
    }

    // Insurance renewal (current vehicle, soonest)
    const policies = db.prepare(
      "SELECT id, provider, renewal_date FROM insurance_policies WHERE vehicle_id = ? AND is_active = 1 ORDER BY renewal_date ASC"
    ).all(vehicleId) as Array<{ id: number; provider: string; renewal_date: string }>

    let insuranceRenewal = null
    if (policies.length > 0) {
      const next = policies[0]
      insuranceRenewal = {
        provider: next.provider,
        daysRemaining: daysBetween(now, new Date(next.renewal_date)),
        renewalDate: next.renewal_date,
        policyId: next.id,
      }
    }

    // Upcoming legal/document expiry (registration, road tax, inspection, etc.)
    const docs = db.prepare(
      "SELECT id, doc_type, title, expiry_date FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC"
    ).all(vehicleId) as Array<{ id: number; doc_type: string; title: string; expiry_date: string }>

    let upcomingDocument = null
    if (docs.length > 0) {
      const next = docs[0]
      upcomingDocument = {
        title: next.title,
        docType: next.doc_type as DocumentType,
        daysRemaining: daysBetween(now, new Date(next.expiry_date)),
        expiryDate: next.expiry_date,
        documentId: next.id,
      }
    }

    // Tire warning: active tire set with tread ≤ 3mm OR set > 6 years old
    const tireWarning = computeTireWarning(db, vehicleId, odometer)

    // Recent activity
    const recentFuel = db.prepare(
      "SELECT id, date, total_cost as amount, fuel_station as description FROM fuel_log WHERE vehicle_id = ? ORDER BY date DESC, id DESC LIMIT 5"
    ).all(vehicleId) as ActivityRow[]
    const recentMaint = db.prepare(
      "SELECT id, date, cost as amount, description FROM maintenance_log WHERE vehicle_id = ? ORDER BY date DESC, id DESC LIMIT 5"
    ).all(vehicleId) as ActivityRow[]
    const recentNotes = db.prepare(
      "SELECT id, date, 0 as amount, title as description FROM notes WHERE vehicle_id = ? OR vehicle_id IS NULL ORDER BY updated_at DESC LIMIT 5"
    ).all(vehicleId) as ActivityRow[]
    const recentInsurance = db.prepare(
      "SELECT id, created_at as date, premium_amount as amount, provider as description FROM insurance_policies WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 5"
    ).all(vehicleId) as ActivityRow[]

    const activity: ActivityEntry[] = [
      ...recentFuel.map(r => ({ ...r, type: 'fuel' as const, description: r.description ? `Fill-up at ${r.description}` : 'Fuel fill-up' })),
      ...recentMaint.map(r => ({ ...r, type: 'maintenance' as const })),
      ...recentNotes.map(r => ({ ...r, type: 'note' as const })),
      ...recentInsurance.map(r => ({ ...r, type: 'insurance' as const, description: `Insurance: ${r.description}` })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)

    // Total lifetime cost
    const totalFuel = (db.prepare("SELECT SUM(total_cost) as total FROM fuel_log WHERE vehicle_id = ?").get(vehicleId) as SumRow).total ?? 0
    const totalMaint = (db.prepare("SELECT SUM(cost) as total FROM maintenance_log WHERE vehicle_id = ?").get(vehicleId) as SumRow).total ?? 0
    const totalInsurance = (db.prepare("SELECT SUM(premium_amount) as total FROM insurance_policies WHERE vehicle_id = ?").get(vehicleId) as SumRow).total ?? 0
    const totalCost = totalFuel + totalMaint + totalInsurance

    // Monthly trend (last 6 months)
    const monthlyTrend: MonthlyTrendEntry[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i)
      const month = format(d, 'yyyy-MM')
      const start = format(startOfMonth(d), 'yyyy-MM-dd')
      const end = format(endOfMonth(d), 'yyyy-MM-dd')

      const fuel = (db.prepare("SELECT SUM(total_cost) as total FROM fuel_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, start, end) as SumRow).total ?? 0
      const maint = (db.prepare("SELECT SUM(cost) as total FROM maintenance_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, start, end) as SumRow).total ?? 0
      const ins = (db.prepare("SELECT SUM(premium_amount) as total FROM insurance_policies WHERE vehicle_id = ? AND start_date <= ? AND (renewal_date >= ? OR is_active = 1)").get(vehicleId, end, start) as SumRow).total ?? 0

      monthlyTrend.push({
        month,
        label: format(d, 'MMM yy'),
        fuel: Math.round(fuel * 100) / 100,
        maintenance: Math.round(maint * 100) / 100,
        insurance: Math.round(ins * 100) / 100,
        other: 0,
        total: Math.round((fuel + maint + ins) * 100) / 100,
      })
    }

    return {
      monthlyFuelCost: Math.round(monthlyFuelCost * 100) / 100,
      avgConsumption: avgConsumption !== null ? Math.round(avgConsumption * 100) / 100 : null,
      nextService,
      insuranceRenewal,
      upcomingDocument,
      tireWarning,
      recentActivity: activity,
      totalCost: Math.round(totalCost * 100) / 100,
      monthlyTrend,
    }
  })
}

interface TireSetMin {
  id: number
  install_date: string
  install_odometer: number
}
interface InspectionMin {
  tread_fl: number | null; tread_fr: number | null
  tread_rl: number | null; tread_rr: number | null
}

function computeTireWarning(
  db: ReturnType<typeof import('../db').getDb>,
  vehicleId: number,
  odometer: number
): { tireSetId: number; reason: string } | null {
  const sets = db.prepare(
    "SELECT id, install_date, install_odometer FROM tire_sets WHERE vehicle_id = ? AND retired_date IS NULL ORDER BY install_date DESC LIMIT 1"
  ).all(vehicleId) as TireSetMin[]
  if (sets.length === 0) return null
  const set = sets[0]

  const installDate = new Date(set.install_date)
  const ageYears = (Date.now() - installDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  if (ageYears > 6) {
    return { tireSetId: set.id, reason: `Tires are ${ageYears.toFixed(1)} years old — rubber hardens past 6 years even with good tread.` }
  }

  const insp = db.prepare(
    "SELECT tread_fl, tread_fr, tread_rl, tread_rr FROM tire_inspections WHERE tire_set_id = ? ORDER BY date DESC LIMIT 1"
  ).get(set.id) as InspectionMin | undefined
  if (insp) {
    const treads = [insp.tread_fl, insp.tread_fr, insp.tread_rl, insp.tread_rr]
      .filter((v): v is number => v !== null)
    if (treads.length && Math.min(...treads) <= 3) {
      return { tireSetId: set.id, reason: `Minimum tread depth is ${Math.min(...treads).toFixed(1)} mm — legal limit is 1.6 mm, replace at 2 mm.` }
    }
  }

  // Heuristic km-based warning if no inspection logged yet
  const kmOnTires = odometer - set.install_odometer
  if (kmOnTires > 60000) {
    return { tireSetId: set.id, reason: `${kmOnTires.toFixed(0)} km on these tires — check tread depth.` }
  }

  return null
}
