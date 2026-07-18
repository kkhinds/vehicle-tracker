import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId, recomputeVehicleOdometer } from '../db'
import { deletePhotoFiles } from '../photos'

interface FuelRow {
  id: number
  vehicle_id: number
  date: string
  odometer: number
  litres: number
  cost_per_litre: number
  total_cost: number
  fuel_station: string | null
  full_tank: number
  notes: string | null
  receipt_photo: string | null
  consumption: number | null
  created_at: string
}

function rowToEntry(row: FuelRow) {
  return { ...row, full_tank: row.full_tank === 1 }
}

type Db = ReturnType<typeof getDb>

/**
 * Recompute consumption for every full-tank entry using the fill-to-full method:
 * distance between two consecutive full fills / litres added across that span
 * (partial fills in between included). Stored on the later full-tank entry.
 * Recomputed wholesale after any add/edit/delete so a changed partial fill
 * correctly re-flows into its span's economy.
 */
function recomputeConsumption(db: Db, vehicleId: number): void {
  const rows = db.prepare(
    'SELECT id, odometer, litres, full_tank FROM fuel_log WHERE vehicle_id = ? ORDER BY odometer ASC, id ASC'
  ).all<{ id: number; odometer: number; litres: number; full_tank: number }>(vehicleId)

  let lastFullOdo: number | null = null
  let litresSinceFull = 0
  const stmt = db.prepare('UPDATE fuel_log SET consumption = ? WHERE id = ?')
  const apply = db.transaction(() => {
    for (const r of rows) {
      if (lastFullOdo !== null) litresSinceFull += r.litres
      let consumption: number | null = null
      if (r.full_tank === 1) {
        if (lastFullOdo !== null) {
          const km = r.odometer - lastFullOdo
          if (km > 0 && litresSinceFull > 0) consumption = km / litresSinceFull
        }
        lastFullOdo = r.odometer
        litresSinceFull = 0
      }
      stmt.run(consumption, r.id)
    }
  })
  apply()
}

export function registerFuelHandlers(): void {
  const db = getDb()

  ipcMain.handle('fuel:getAll', () => {
    const vehicleId = getCurrentVehicleId()
    const rows = db.prepare(
      'SELECT * FROM fuel_log WHERE vehicle_id = ? ORDER BY date DESC, id DESC'
    ).all(vehicleId) as FuelRow[]
    return rows.map(rowToEntry)
  })

  ipcMain.handle('fuel:add', (_, entry: Omit<FuelRow, 'id' | 'created_at' | 'consumption' | 'vehicle_id' | 'full_tank'> & { full_tank: boolean }) => {
    const vehicleId = getCurrentVehicleId()

    const result = db.prepare(`
      INSERT INTO fuel_log (vehicle_id, date, odometer, litres, cost_per_litre, total_cost, fuel_station, full_tank, notes, receipt_photo, consumption)
      VALUES (@vehicle_id, @date, @odometer, @litres, @cost_per_litre, @total_cost, @fuel_station, @full_tank, @notes, @receipt_photo, NULL)
    `).run({
      ...entry,
      vehicle_id: vehicleId,
      full_tank: entry.full_tank ? 1 : 0,
      fuel_station: entry.fuel_station ?? null,
      notes: entry.notes ?? null,
      receipt_photo: entry.receipt_photo ?? null,
    })

    recomputeConsumption(db, vehicleId)
    recomputeVehicleOdometer(db, vehicleId)

    return rowToEntry(db.prepare('SELECT * FROM fuel_log WHERE id = ?').get(result.lastInsertRowid) as FuelRow)
  })

  ipcMain.handle('fuel:update', (_, id: number, entry: Partial<Omit<FuelRow, 'full_tank'> & { full_tank: boolean }>) => {
    const current = db.prepare('SELECT * FROM fuel_log WHERE id = ?').get(id) as FuelRow
    if (!current) return

    const merged = { ...current, ...entry, full_tank: entry.full_tank !== undefined ? (entry.full_tank ? 1 : 0) : current.full_tank }

    // Unlink the old receipt if this edit replaced or cleared it.
    if (current.receipt_photo && current.receipt_photo !== merged.receipt_photo) {
      deletePhotoFiles([current.receipt_photo])
    }

    db.prepare(`
      UPDATE fuel_log SET date=@date, odometer=@odometer, litres=@litres, cost_per_litre=@cost_per_litre,
      total_cost=@total_cost, fuel_station=@fuel_station, full_tank=@full_tank, notes=@notes,
      receipt_photo=@receipt_photo WHERE id=@id
    `).run({ ...merged, id })

    recomputeConsumption(db, current.vehicle_id)
    recomputeVehicleOdometer(db, current.vehicle_id)
  })

  ipcMain.handle('fuel:delete', (_, id: number) => {
    const row = db.prepare('SELECT vehicle_id, receipt_photo FROM fuel_log WHERE id = ?').get(id) as { vehicle_id: number; receipt_photo: string | null } | undefined
    db.prepare('DELETE FROM fuel_log WHERE id = ?').run(id)
    if (row) {
      deletePhotoFiles([row.receipt_photo])
      recomputeConsumption(db, row.vehicle_id)
      recomputeVehicleOdometer(db, row.vehicle_id)
    }
  })
}
