import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { daysUntil, addMonthsISO } from '../dates'

interface IntervalRow {
  id: number
  vehicle_id: number
  name: string
  category_key: string | null
  interval_km: number
  interval_months: number | null
  last_done_km: number | null
  last_done_date: string | null
  is_custom: number
  consequence_of_skipping: string | null
  notes: string | null
}

type Status = 'ok' | 'due-soon' | 'overdue'
const RANK: Record<Status, number> = { ok: 0, 'due-soon': 1, overdue: 2 }

interface VehicleOdometerRow { current_odometer: number }

function getVehicleOdometer(db: ReturnType<typeof import('../db').getDb>, vehicleId: number): number {
  const row = db.prepare(
    'SELECT current_odometer FROM vehicles WHERE id = ?'
  ).get(vehicleId) as VehicleOdometerRow | undefined
  return row?.current_odometer ?? 0
}

export function registerScheduleHandlers(): void {
  const db = getDb()

  ipcMain.handle('schedule:getAll', () => {
    const vehicleId = getCurrentVehicleId()
    const rows = db.prepare(
      'SELECT * FROM service_intervals WHERE vehicle_id = ? ORDER BY interval_km ASC'
    ).all(vehicleId) as IntervalRow[]
    const odometer = getVehicleOdometer(db, vehicleId)

    return rows.map(row => {
      const nextDueKm = (row.last_done_km ?? 0) + row.interval_km
      const kmRemaining = nextDueKm - odometer
      const kmStatus: Status = kmRemaining <= 0 ? 'overdue' : kmRemaining <= 1000 ? 'due-soon' : 'ok'

      // Time-based due, only when the interval has a month period AND a last-done date.
      let nextDueDate: string | null = null
      let daysRemaining: number | null = null
      let dateStatus: Status = 'ok'
      if (row.interval_months && row.last_done_date) {
        nextDueDate = addMonthsISO(row.last_done_date, row.interval_months)
        daysRemaining = daysUntil(nextDueDate)
        dateStatus = daysRemaining <= 0 ? 'overdue' : daysRemaining <= 30 ? 'due-soon' : 'ok'
      }

      // Due = whichever dimension is more urgent.
      const status: Status = RANK[dateStatus] > RANK[kmStatus] ? dateStatus : kmStatus

      return {
        ...row,
        is_custom: row.is_custom === 1,
        next_due_km: nextDueKm,
        km_remaining: kmRemaining,
        next_due_date: nextDueDate,
        days_remaining: daysRemaining,
        status,
      }
    })
  })

  ipcMain.handle('schedule:add', (_, interval: Omit<IntervalRow, 'id' | 'vehicle_id'>) => {
    const vehicleId = getCurrentVehicleId()
    const result = db.prepare(`
      INSERT INTO service_intervals (vehicle_id, name, category_key, interval_km, interval_months, last_done_km, last_done_date, is_custom, consequence_of_skipping, notes)
      VALUES (@vehicle_id, @name, @category_key, @interval_km, @interval_months, @last_done_km, @last_done_date, @is_custom, @consequence_of_skipping, @notes)
    `).run({
      ...interval,
      vehicle_id: vehicleId,
      is_custom: 1,
      category_key: interval.category_key ?? null,
      interval_months: interval.interval_months ?? null,
      last_done_km: interval.last_done_km ?? null,
      last_done_date: interval.last_done_date ?? null,
      consequence_of_skipping: interval.consequence_of_skipping ?? null,
      notes: interval.notes ?? null,
    })
    return db.prepare('SELECT * FROM service_intervals WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('schedule:update', (_, id: number, data: Partial<IntervalRow>) => {
    const current = db.prepare('SELECT * FROM service_intervals WHERE id = ?').get(id) as IntervalRow
    if (!current) return
    const merged = { ...current, ...data, is_custom: data.is_custom !== undefined ? (data.is_custom ? 1 : 0) : current.is_custom }
    db.prepare(`
      UPDATE service_intervals SET name=@name, category_key=@category_key, interval_km=@interval_km,
        interval_months=@interval_months, last_done_km=@last_done_km, last_done_date=@last_done_date,
        is_custom=@is_custom, consequence_of_skipping=@consequence_of_skipping, notes=@notes WHERE id=@id
    `).run({ ...merged, id })
  })

  ipcMain.handle('schedule:delete', (_, id: number) => {
    db.prepare('DELETE FROM service_intervals WHERE id = ?').run(id)
  })

  ipcMain.handle('schedule:complete', (_, id: number, odometer: number, date: string) => {
    const interval = db.prepare('SELECT * FROM service_intervals WHERE id = ?').get(id) as IntervalRow
    if (!interval) return

    db.prepare(
      'UPDATE service_intervals SET last_done_km = ?, last_done_date = ? WHERE id = ?'
    ).run(odometer, date, id)

    // Bump the vehicle's current_odometer if this reading is higher.
    db.prepare(
      'UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?'
    ).run(odometer, interval.vehicle_id)

    // Auto-create a maintenance log entry for the vehicle this interval belongs to.
    db.prepare(`
      INSERT INTO maintenance_log (vehicle_id, date, odometer, category, description, cost)
      VALUES (?, ?, ?, 'Other', ?, 0)
    `).run(interval.vehicle_id, date, odometer, interval.name)
  })

  /**
   * Mark a service interval as done WITHOUT also creating a maintenance log entry.
   * Used when the user logs a maintenance record first, then we offer to update
   * the matching interval. We don't want to create a duplicate maintenance row.
   */
  ipcMain.handle('schedule:markDone', (_, id: number, odometer: number, date: string) => {
    const interval = db.prepare('SELECT * FROM service_intervals WHERE id = ?').get(id) as IntervalRow
    if (!interval) return

    db.prepare(
      'UPDATE service_intervals SET last_done_km = ?, last_done_date = ? WHERE id = ?'
    ).run(odometer, date, id)

    db.prepare(
      'UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?'
    ).run(odometer, interval.vehicle_id)
  })
}
