import { ipcMain } from 'electron'
import { getDb } from '../db'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import type { ActivityEntry, MonthlyTrendEntry } from '../../../src/types'

interface SettingRow { value: string }
interface SumRow { total: number | null }
interface AvgRow { avg: number | null }
interface ActivityRow { id: number; date: string; description: string; amount: number }

export function registerDashboardHandlers(): void {
  const db = getDb()

  ipcMain.handle('dashboard:getSummary', () => {
    const now = new Date()
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

    // Monthly fuel cost
    const fuelMonth = db.prepare(
      "SELECT SUM(total_cost) as total FROM fuel_log WHERE date >= ? AND date <= ?"
    ).get(monthStart, monthEnd) as SumRow
    const monthlyFuelCost = fuelMonth.total ?? 0

    // Average consumption
    const avgRow = db.prepare(
      "SELECT AVG(consumption) as avg FROM fuel_log WHERE consumption IS NOT NULL AND full_tank = 1"
    ).get() as AvgRow
    const avgConsumption = avgRow.avg ?? null

    // Next service
    const odometer = parseFloat(
      (db.prepare("SELECT value FROM settings WHERE key = 'current_odometer'").get() as SettingRow)?.value ?? '0'
    )
    const intervals = db.prepare('SELECT * FROM service_intervals ORDER BY interval_km ASC').all() as Array<{
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

    // Insurance renewal
    const policies = db.prepare(
      "SELECT id, provider, renewal_date FROM insurance_policies WHERE is_active = 1 ORDER BY renewal_date ASC"
    ).all() as Array<{ id: number; provider: string; renewal_date: string }>

    let insuranceRenewal = null
    if (policies.length > 0) {
      const next = policies[0]
      const renewalDate = new Date(next.renewal_date)
      const daysRemaining = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      insuranceRenewal = {
        provider: next.provider,
        daysRemaining,
        renewalDate: next.renewal_date,
        policyId: next.id,
      }
    }

    // Recent activity (last 5 entries across all modules)
    const recentFuel = db.prepare(
      "SELECT id, date, total_cost as amount, fuel_station as description FROM fuel_log ORDER BY date DESC, id DESC LIMIT 5"
    ).all() as ActivityRow[]
    const recentMaint = db.prepare(
      "SELECT id, date, cost as amount, description FROM maintenance_log ORDER BY date DESC, id DESC LIMIT 5"
    ).all() as ActivityRow[]
    const recentNotes = db.prepare(
      "SELECT id, date, 0 as amount, title as description FROM notes ORDER BY updated_at DESC LIMIT 5"
    ).all() as ActivityRow[]
    const recentInsurance = db.prepare(
      "SELECT id, created_at as date, premium_amount as amount, provider as description FROM insurance_policies ORDER BY created_at DESC LIMIT 5"
    ).all() as ActivityRow[]

    const activity: ActivityEntry[] = [
      ...recentFuel.map(r => ({ ...r, type: 'fuel' as const, description: r.description ? `Fill-up at ${r.description}` : 'Fuel fill-up' })),
      ...recentMaint.map(r => ({ ...r, type: 'maintenance' as const })),
      ...recentNotes.map(r => ({ ...r, type: 'note' as const })),
      ...recentInsurance.map(r => ({ ...r, type: 'insurance' as const, description: `Insurance: ${r.description}` })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)

    // Total lifetime cost
    const totalFuel = (db.prepare("SELECT SUM(total_cost) as total FROM fuel_log").get() as SumRow).total ?? 0
    const totalMaint = (db.prepare("SELECT SUM(cost) as total FROM maintenance_log").get() as SumRow).total ?? 0
    const totalInsurance = (db.prepare("SELECT SUM(premium_amount) as total FROM insurance_policies").get() as SumRow).total ?? 0
    const totalCost = totalFuel + totalMaint + totalInsurance

    // Monthly trend (last 6 months)
    const monthlyTrend: MonthlyTrendEntry[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i)
      const month = format(d, 'yyyy-MM')
      const start = format(startOfMonth(d), 'yyyy-MM-dd')
      const end = format(endOfMonth(d), 'yyyy-MM-dd')

      const fuel = (db.prepare("SELECT SUM(total_cost) as total FROM fuel_log WHERE date >= ? AND date <= ?").get(start, end) as SumRow).total ?? 0
      const maint = (db.prepare("SELECT SUM(cost) as total FROM maintenance_log WHERE date >= ? AND date <= ?").get(start, end) as SumRow).total ?? 0
      const ins = (db.prepare("SELECT SUM(premium_amount) as total FROM insurance_policies WHERE start_date <= ? AND (renewal_date >= ? OR is_active = 1)").get(end, start) as SumRow).total ?? 0

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
      recentActivity: activity,
      totalCost: Math.round(totalCost * 100) / 100,
      monthlyTrend,
    }
  })
}
