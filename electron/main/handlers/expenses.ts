import { ipcMain, app } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { format, subMonths, startOfMonth, endOfMonth, subQuarters, startOfQuarter, endOfQuarter } from 'date-fns'
import fs from 'fs'
import path from 'path'

interface SumRow { total: number | null }

const CATEGORY_COLORS: Record<string, string> = {
  fuel: '#3b82f6',
  maintenance: '#f59e0b',
  insurance: '#8b5cf6',
  tyres: '#10b981',
  other: '#6b7280',
}

export function registerExpensesHandlers(): void {
  const db = getDb()

  ipcMain.handle('expenses:getSummary', (_, startDate?: string, endDate?: string) => {
    const vehicleId = getCurrentVehicleId()
    const now = new Date()
    const from = startDate ?? format(subMonths(now, 11), 'yyyy-MM-dd')
    const to = endDate ?? format(now, 'yyyy-MM-dd')

    const fuelTotal = (db.prepare("SELECT SUM(total_cost) as total FROM fuel_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, from, to) as SumRow).total ?? 0
    const maintTotal = (db.prepare("SELECT SUM(cost) as total FROM maintenance_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, from, to) as SumRow).total ?? 0
    const insTotal = (db.prepare("SELECT SUM(premium_amount) as total FROM insurance_policies WHERE vehicle_id = ? AND start_date <= ?").get(vehicleId, to) as SumRow).total ?? 0
    const docTotal = (db.prepare("SELECT SUM(cost) as total FROM vehicle_documents WHERE vehicle_id = ? AND COALESCE(issued_date, expiry_date) >= ? AND COALESCE(issued_date, expiry_date) <= ?").get(vehicleId, from, to) as SumRow).total ?? 0

    const byCategory = [
      { category: 'Fuel', amount: Math.round(fuelTotal * 100) / 100, color: CATEGORY_COLORS.fuel },
      { category: 'Maintenance', amount: Math.round(maintTotal * 100) / 100, color: CATEGORY_COLORS.maintenance },
      { category: 'Insurance', amount: Math.round(insTotal * 100) / 100, color: CATEGORY_COLORS.insurance },
      { category: 'Documents/Renewals', amount: Math.round(docTotal * 100) / 100, color: CATEGORY_COLORS.other },
    ].filter(c => c.amount > 0)

    // Monthly trend (last 12 months)
    const monthlyTrend = []
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i)
      const month = format(d, 'yyyy-MM')
      const ms = format(startOfMonth(d), 'yyyy-MM-dd')
      const me = format(endOfMonth(d), 'yyyy-MM-dd')
      const fuel = (db.prepare("SELECT SUM(total_cost) as total FROM fuel_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, ms, me) as SumRow).total ?? 0
      const maint = (db.prepare("SELECT SUM(cost) as total FROM maintenance_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, ms, me) as SumRow).total ?? 0
      const ins = (db.prepare("SELECT SUM(premium_amount) as total FROM insurance_policies WHERE vehicle_id = ? AND start_date <= ? AND renewal_date >= ?").get(vehicleId, me, ms) as SumRow).total ?? 0
      monthlyTrend.push({
        month, label: format(d, 'MMM yy'),
        fuel: Math.round(fuel * 100) / 100,
        maintenance: Math.round(maint * 100) / 100,
        insurance: Math.round(ins * 100) / 100,
        other: 0,
        total: Math.round((fuel + maint + ins) * 100) / 100,
      })
    }

    // Quarterly (last 8 quarters)
    const quarterly = []
    for (let i = 7; i >= 0; i--) {
      const d = subQuarters(now, i)
      const qs = format(startOfQuarter(d), 'yyyy-MM-dd')
      const qe = format(endOfQuarter(d), 'yyyy-MM-dd')
      const f = (db.prepare("SELECT SUM(total_cost) as total FROM fuel_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, qs, qe) as SumRow).total ?? 0
      const m = (db.prepare("SELECT SUM(cost) as total FROM maintenance_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, qs, qe) as SumRow).total ?? 0
      quarterly.push({ quarter: `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`, amount: Math.round((f + m) * 100) / 100 })
    }

    // Yearly (last 5 years)
    const yearly = []
    for (let i = 4; i >= 0; i--) {
      const year = now.getFullYear() - i
      const ys = `${year}-01-01`
      const ye = `${year}-12-31`
      const f = (db.prepare("SELECT SUM(total_cost) as total FROM fuel_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, ys, ye) as SumRow).total ?? 0
      const m = (db.prepare("SELECT SUM(cost) as total FROM maintenance_log WHERE vehicle_id = ? AND date >= ? AND date <= ?").get(vehicleId, ys, ye) as SumRow).total ?? 0
      yearly.push({ year: String(year), amount: Math.round((f + m) * 100) / 100 })
    }

    const totalCost = byCategory.reduce((sum, c) => sum + c.amount, 0)

    return { byCategory, monthlyTrend, totalCost: Math.round(totalCost * 100) / 100, quarterly, yearly }
  })

  ipcMain.handle('expenses:exportCsv', (_, startDate?: string, endDate?: string, category?: string) => {
    const vehicleId = getCurrentVehicleId()
    const now = new Date()
    const from = startDate ?? '2000-01-01'
    const to = endDate ?? format(now, 'yyyy-MM-dd')

    const rows: string[] = ['Date,Category,Description,Amount,Notes']

    if (!category || category === 'fuel') {
      const fuel = db.prepare("SELECT date, total_cost, fuel_station, litres, notes FROM fuel_log WHERE vehicle_id = ? AND date >= ? AND date <= ? ORDER BY date DESC").all(vehicleId, from, to) as Array<{ date: string; total_cost: number; fuel_station: string | null; litres: number; notes: string | null }>
      for (const r of fuel) {
        rows.push(`${r.date},Fuel,"${r.fuel_station ?? 'Unknown station'} (${r.litres}L)",${r.total_cost},"${r.notes ?? ''}"`)
      }
    }

    if (!category || category === 'maintenance') {
      const maint = db.prepare("SELECT date, category, description, cost, notes FROM maintenance_log WHERE vehicle_id = ? AND date >= ? AND date <= ? ORDER BY date DESC").all(vehicleId, from, to) as Array<{ date: string; category: string; description: string; cost: number; notes: string | null }>
      for (const r of maint) {
        rows.push(`${r.date},Maintenance - ${r.category},"${r.description}",${r.cost},"${r.notes ?? ''}"`)
      }
    }

    if (!category || category === 'insurance') {
      const ins = db.prepare("SELECT start_date, provider, policy_number, premium_amount, payment_frequency FROM insurance_policies WHERE vehicle_id = ? AND start_date <= ? ORDER BY start_date DESC").all(vehicleId, to) as Array<{ start_date: string; provider: string; policy_number: string; premium_amount: number; payment_frequency: string }>
      for (const r of ins) {
        rows.push(`${r.start_date},Insurance,"${r.provider} - ${r.policy_number} (${r.payment_frequency})",${r.premium_amount},""`)
      }
    }

    const csv = rows.join('\n')
    const exportPath = path.join(app.getPath('downloads'), `vehicle-expenses-${format(now, 'yyyy-MM-dd')}.csv`)
    fs.writeFileSync(exportPath, csv, 'utf8')
    return exportPath
  })
}
