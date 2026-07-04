import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { deletePhotoFiles } from '../photos'

interface TireSetRow {
  id: number
  vehicle_id: number
  brand: string
  model: string
  size: string
  dot_date: string | null
  install_date: string
  install_odometer: number
  retired_date: string | null
  retired_odometer: number | null
  recommended_psi_front: number | null
  recommended_psi_rear: number | null
  notes: string | null
  created_at: string
}

interface TireInspectionRow {
  id: number
  tire_set_id: number
  date: string
  odometer: number
  tread_fl: number | null
  tread_fr: number | null
  tread_rl: number | null
  tread_rr: number | null
  pressure_fl: number | null
  pressure_fr: number | null
  pressure_rl: number | null
  pressure_rr: number | null
  notes: string | null
  photo: string | null
  created_at: string
}

interface TireRotationRow {
  id: number
  tire_set_id: number
  date: string
  odometer: number
  pattern: string
  notes: string | null
  created_at: string
}

function computeMeta(row: TireSetRow) {
  const installDate = new Date(row.install_date)
  const ageYears = (Date.now() - installDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return {
    ...row,
    age_years: Math.round(ageYears * 10) / 10,
    is_active: row.retired_date === null,
  }
}

export function registerTireHandlers(): void {
  const db = getDb()

  // ─── Tire sets ──────────────────────────────────────────────────────────
  ipcMain.handle('tires:getSets', () => {
    const vehicleId = getCurrentVehicleId()
    const rows = db.prepare(
      'SELECT * FROM tire_sets WHERE vehicle_id = ? ORDER BY retired_date IS NOT NULL, install_date DESC'
    ).all(vehicleId) as TireSetRow[]
    return rows.map(computeMeta)
  })

  ipcMain.handle('tires:addSet', (_, set: Omit<TireSetRow, 'id' | 'created_at' | 'vehicle_id'>) => {
    const vehicleId = getCurrentVehicleId()
    const result = db.prepare(`
      INSERT INTO tire_sets (vehicle_id, brand, model, size, dot_date, install_date, install_odometer,
        retired_date, retired_odometer, recommended_psi_front, recommended_psi_rear, notes)
      VALUES (@vehicle_id, @brand, @model, @size, @dot_date, @install_date, @install_odometer,
        @retired_date, @retired_odometer, @recommended_psi_front, @recommended_psi_rear, @notes)
    `).run({
      ...set,
      vehicle_id: vehicleId,
      dot_date: set.dot_date ?? null,
      retired_date: set.retired_date ?? null,
      retired_odometer: set.retired_odometer ?? null,
      recommended_psi_front: set.recommended_psi_front ?? null,
      recommended_psi_rear: set.recommended_psi_rear ?? null,
      notes: set.notes ?? null,
    })
    const row = db.prepare('SELECT * FROM tire_sets WHERE id = ?').get(result.lastInsertRowid) as TireSetRow
    return computeMeta(row)
  })

  ipcMain.handle('tires:updateSet', (_, id: number, data: Partial<TireSetRow>) => {
    const current = db.prepare('SELECT * FROM tire_sets WHERE id = ?').get(id) as TireSetRow
    if (!current) return
    const merged = { ...current, ...data }
    db.prepare(`
      UPDATE tire_sets SET brand=@brand, model=@model, size=@size, dot_date=@dot_date,
        install_date=@install_date, install_odometer=@install_odometer, retired_date=@retired_date,
        retired_odometer=@retired_odometer, recommended_psi_front=@recommended_psi_front,
        recommended_psi_rear=@recommended_psi_rear, notes=@notes WHERE id=@id
    `).run({ ...merged, id })
  })

  ipcMain.handle('tires:deleteSet', (_, id: number) => {
    // Inspections cascade-delete with the set; collect their photos first.
    const photos = (db.prepare('SELECT photo FROM tire_inspections WHERE tire_set_id = ? AND photo IS NOT NULL').all(id) as { photo: string }[]).map(r => r.photo)
    db.prepare('DELETE FROM tire_sets WHERE id = ?').run(id)
    deletePhotoFiles(photos)
  })

  ipcMain.handle('tires:retireSet', (_, id: number, date: string, odometer: number) => {
    db.prepare(
      'UPDATE tire_sets SET retired_date = ?, retired_odometer = ? WHERE id = ?'
    ).run(date, odometer, id)
  })

  // ─── Inspections ────────────────────────────────────────────────────────
  ipcMain.handle('tires:getInspections', (_, tireSetId: number) => {
    return db.prepare(
      'SELECT * FROM tire_inspections WHERE tire_set_id = ? ORDER BY date DESC, id DESC'
    ).all(tireSetId)
  })

  ipcMain.handle('tires:addInspection', (_, inspection: Omit<TireInspectionRow, 'id' | 'created_at'>) => {
    const result = db.prepare(`
      INSERT INTO tire_inspections (tire_set_id, date, odometer,
        tread_fl, tread_fr, tread_rl, tread_rr,
        pressure_fl, pressure_fr, pressure_rl, pressure_rr,
        notes, photo)
      VALUES (@tire_set_id, @date, @odometer,
        @tread_fl, @tread_fr, @tread_rl, @tread_rr,
        @pressure_fl, @pressure_fr, @pressure_rl, @pressure_rr,
        @notes, @photo)
    `).run({
      ...inspection,
      tread_fl: inspection.tread_fl ?? null,
      tread_fr: inspection.tread_fr ?? null,
      tread_rl: inspection.tread_rl ?? null,
      tread_rr: inspection.tread_rr ?? null,
      pressure_fl: inspection.pressure_fl ?? null,
      pressure_fr: inspection.pressure_fr ?? null,
      pressure_rl: inspection.pressure_rl ?? null,
      pressure_rr: inspection.pressure_rr ?? null,
      notes: inspection.notes ?? null,
      photo: inspection.photo ?? null,
    })
    return db.prepare('SELECT * FROM tire_inspections WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('tires:deleteInspection', (_, id: number) => {
    const row = db.prepare('SELECT photo FROM tire_inspections WHERE id = ?').get(id) as { photo: string | null } | undefined
    db.prepare('DELETE FROM tire_inspections WHERE id = ?').run(id)
    if (row) deletePhotoFiles([row.photo])
  })

  // ─── Rotations ──────────────────────────────────────────────────────────
  ipcMain.handle('tires:getRotations', (_, tireSetId: number) => {
    return db.prepare(
      'SELECT * FROM tire_rotations WHERE tire_set_id = ? ORDER BY date DESC, id DESC'
    ).all(tireSetId)
  })

  ipcMain.handle('tires:addRotation', (_, rotation: Omit<TireRotationRow, 'id' | 'created_at'>) => {
    const result = db.prepare(`
      INSERT INTO tire_rotations (tire_set_id, date, odometer, pattern, notes)
      VALUES (@tire_set_id, @date, @odometer, @pattern, @notes)
    `).run({ ...rotation, notes: rotation.notes ?? null })
    return db.prepare('SELECT * FROM tire_rotations WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('tires:deleteRotation', (_, id: number) => {
    db.prepare('DELETE FROM tire_rotations WHERE id = ?').run(id)
  })
}
