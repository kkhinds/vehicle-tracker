import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'

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

export function registerFuelHandlers(): void {
  const db = getDb()

  ipcMain.handle('fuel:getAll', () => {
    const vehicleId = getCurrentVehicleId()
    const rows = db.prepare(
      'SELECT * FROM fuel_log WHERE vehicle_id = ? ORDER BY date DESC, id DESC'
    ).all(vehicleId) as FuelRow[]
    return rows.map(rowToEntry)
  })

  ipcMain.handle('fuel:add', (_, entry: Omit<FuelRow, 'id' | 'created_at' | 'consumption' | 'vehicle_id'> & { full_tank: boolean }) => {
    const vehicleId = getCurrentVehicleId()

    let consumption: number | null = null
    if (entry.full_tank) {
      const prev = db.prepare(
        'SELECT * FROM fuel_log WHERE vehicle_id = ? AND full_tank = 1 AND odometer < ? ORDER BY odometer DESC LIMIT 1'
      ).get(vehicleId, entry.odometer) as FuelRow | undefined
      if (prev) {
        const kmDriven = entry.odometer - prev.odometer
        if (kmDriven > 0) consumption = kmDriven / entry.litres
      }
    }

    const result = db.prepare(`
      INSERT INTO fuel_log (vehicle_id, date, odometer, litres, cost_per_litre, total_cost, fuel_station, full_tank, notes, receipt_photo, consumption)
      VALUES (@vehicle_id, @date, @odometer, @litres, @cost_per_litre, @total_cost, @fuel_station, @full_tank, @notes, @receipt_photo, @consumption)
    `).run({
      ...entry,
      vehicle_id: vehicleId,
      full_tank: entry.full_tank ? 1 : 0,
      consumption,
      fuel_station: entry.fuel_station ?? null,
      notes: entry.notes ?? null,
      receipt_photo: entry.receipt_photo ?? null,
    })

    // Update the vehicle's current_odometer if this is the newest reading.
    db.prepare(
      'UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?'
    ).run(entry.odometer, vehicleId)

    return rowToEntry(db.prepare('SELECT * FROM fuel_log WHERE id = ?').get(result.lastInsertRowid) as FuelRow)
  })

  ipcMain.handle('fuel:update', (_, id: number, entry: Partial<FuelRow & { full_tank: boolean }>) => {
    const current = db.prepare('SELECT * FROM fuel_log WHERE id = ?').get(id) as FuelRow
    if (!current) return

    const merged = { ...current, ...entry, full_tank: entry.full_tank !== undefined ? (entry.full_tank ? 1 : 0) : current.full_tank }

    let consumption = merged.consumption
    if (merged.full_tank === 1) {
      const prev = db.prepare(
        'SELECT * FROM fuel_log WHERE vehicle_id = ? AND full_tank = 1 AND odometer < ? AND id != ? ORDER BY odometer DESC LIMIT 1'
      ).get(current.vehicle_id, merged.odometer, id) as FuelRow | undefined
      if (prev) {
        const kmDriven = merged.odometer - prev.odometer
        if (kmDriven > 0) consumption = kmDriven / merged.litres
      }
    } else {
      consumption = null
    }

    db.prepare(`
      UPDATE fuel_log SET date=@date, odometer=@odometer, litres=@litres, cost_per_litre=@cost_per_litre,
      total_cost=@total_cost, fuel_station=@fuel_station, full_tank=@full_tank, notes=@notes,
      receipt_photo=@receipt_photo, consumption=@consumption WHERE id=@id
    `).run({ ...merged, consumption, id })
  })

  ipcMain.handle('fuel:delete', (_, id: number) => {
    db.prepare('DELETE FROM fuel_log WHERE id = ?').run(id)
  })
}
