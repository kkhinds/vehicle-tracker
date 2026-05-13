import { ipcMain } from 'electron'
import { getDb } from '../db'

interface IntervalRow {
  id: number
  name: string
  interval_km: number
  last_done_km: number | null
  last_done_date: string | null
  is_custom: number
  notes: string | null
}

interface SettingRow {
  value: string
}

export function registerScheduleHandlers(): void {
  const db = getDb()

  ipcMain.handle('schedule:getAll', () => {
    const rows = db.prepare('SELECT * FROM service_intervals ORDER BY interval_km ASC').all() as IntervalRow[]
    const odometer = parseFloat(
      (db.prepare("SELECT value FROM settings WHERE key = 'current_odometer'").get() as SettingRow)?.value ?? '0'
    )

    return rows.map(row => {
      const nextDueKm = (row.last_done_km ?? 0) + row.interval_km
      const kmRemaining = nextDueKm - odometer
      let status: 'ok' | 'due-soon' | 'overdue' = 'ok'
      if (kmRemaining <= 0) status = 'overdue'
      else if (kmRemaining <= 1000) status = 'due-soon'

      return {
        ...row,
        is_custom: row.is_custom === 1,
        next_due_km: nextDueKm,
        km_remaining: kmRemaining,
        status,
      }
    })
  })

  ipcMain.handle('schedule:add', (_, interval: Omit<IntervalRow, 'id'>) => {
    const result = db.prepare(`
      INSERT INTO service_intervals (name, interval_km, last_done_km, last_done_date, is_custom, notes)
      VALUES (@name, @interval_km, @last_done_km, @last_done_date, @is_custom, @notes)
    `).run({
      ...interval,
      is_custom: 1,
      last_done_km: interval.last_done_km ?? null,
      last_done_date: interval.last_done_date ?? null,
      notes: interval.notes ?? null,
    })
    return db.prepare('SELECT * FROM service_intervals WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('schedule:update', (_, id: number, data: Partial<IntervalRow>) => {
    const current = db.prepare('SELECT * FROM service_intervals WHERE id = ?').get(id) as IntervalRow
    if (!current) return
    const merged = { ...current, ...data, is_custom: data.is_custom !== undefined ? (data.is_custom ? 1 : 0) : current.is_custom }
    db.prepare(`
      UPDATE service_intervals SET name=@name, interval_km=@interval_km, last_done_km=@last_done_km,
      last_done_date=@last_done_date, is_custom=@is_custom, notes=@notes WHERE id=@id
    `).run({ ...merged, id })
  })

  ipcMain.handle('schedule:delete', (_, id: number) => {
    db.prepare('DELETE FROM service_intervals WHERE id = ?').run(id)
  })

  ipcMain.handle('schedule:complete', (_, id: number, odometer: number, date: string) => {
    const interval = db.prepare('SELECT * FROM service_intervals WHERE id = ?').get(id) as IntervalRow
    if (!interval) return

    // Update the service interval's last done values
    db.prepare(
      'UPDATE service_intervals SET last_done_km = ?, last_done_date = ? WHERE id = ?'
    ).run(odometer, date, id)

    // Also update global odometer if this reading is higher
    const currentOdometer = parseFloat(
      (db.prepare("SELECT value FROM settings WHERE key = 'current_odometer'").get() as SettingRow)?.value ?? '0'
    )
    if (odometer > currentOdometer) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'current_odometer'").run(String(odometer))
    }

    // Auto-create a maintenance log entry
    db.prepare(`
      INSERT INTO maintenance_log (date, odometer, category, description, cost)
      VALUES (?, ?, 'Other', ?, 0)
    `).run(date, odometer, interval.name)
  })
}
