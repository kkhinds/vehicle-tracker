import { ipcMain } from 'electron'
import { getDb, seedIntervalsForVehicle } from '../db'
import { deletePhotoFiles } from '../photos'

interface VehicleRow {
  id: number
  nickname: string
  make: string
  model: string
  year: number
  trim: string | null
  drivetrain: string
  vin: string | null
  license_plate: string | null
  color: string | null
  photo: string | null
  purchase_date: string | null
  purchase_odometer: number | null
  current_odometer: number
  is_archived: number
  created_at: string
}

function rowToVehicle(row: VehicleRow) {
  return { ...row, is_archived: row.is_archived === 1 }
}

export function registerVehicleHandlers(): void {
  const db = getDb()

  ipcMain.handle('vehicles:getAll', () => {
    const rows = db.prepare(
      'SELECT * FROM vehicles ORDER BY is_archived ASC, id ASC'
    ).all() as VehicleRow[]
    return rows.map(rowToVehicle)
  })

  ipcMain.handle('vehicles:get', (_, id: number) => {
    const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as VehicleRow | undefined
    return row ? rowToVehicle(row) : null
  })

  ipcMain.handle('vehicles:add', (_, vehicle: Omit<VehicleRow, 'id' | 'created_at' | 'is_archived'> & { is_archived?: boolean }) => {
    const result = db.prepare(`
      INSERT INTO vehicles (nickname, make, model, year, trim, drivetrain, vin, license_plate,
        color, photo, purchase_date, purchase_odometer, current_odometer, is_archived)
      VALUES (@nickname, @make, @model, @year, @trim, @drivetrain, @vin, @license_plate,
        @color, @photo, @purchase_date, @purchase_odometer, @current_odometer, @is_archived)
    `).run({
      ...vehicle,
      trim: vehicle.trim ?? null,
      vin: vehicle.vin ?? null,
      license_plate: vehicle.license_plate ?? null,
      color: vehicle.color ?? null,
      photo: vehicle.photo ?? null,
      purchase_date: vehicle.purchase_date ?? null,
      purchase_odometer: vehicle.purchase_odometer ?? null,
      current_odometer: vehicle.current_odometer ?? 0,
      is_archived: vehicle.is_archived ? 1 : 0,
    })

    const id = result.lastInsertRowid as number
    // Seed drivetrain-appropriate service intervals for the new vehicle.
    seedIntervalsForVehicle(db, id, vehicle.drivetrain)

    const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as VehicleRow
    return rowToVehicle(row)
  })

  ipcMain.handle('vehicles:update', (_, id: number, data: Partial<VehicleRow & { is_archived: boolean }>) => {
    const current = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as VehicleRow
    if (!current) return
    const merged = {
      ...current,
      ...data,
      is_archived: data.is_archived !== undefined ? (data.is_archived ? 1 : 0) : current.is_archived,
    }
    db.prepare(`
      UPDATE vehicles SET nickname=@nickname, make=@make, model=@model, year=@year, trim=@trim,
        drivetrain=@drivetrain, vin=@vin, license_plate=@license_plate, color=@color, photo=@photo,
        purchase_date=@purchase_date, purchase_odometer=@purchase_odometer,
        current_odometer=@current_odometer, is_archived=@is_archived
      WHERE id=@id
    `).run({ ...merged, id })
  })

  ipcMain.handle('vehicles:delete', (_, id: number) => {
    // Prevent deleting the last non-archived vehicle (the app needs at least one).
    const { count } = db.prepare(
      'SELECT COUNT(*) as count FROM vehicles WHERE is_archived = 0'
    ).get() as { count: number }
    if (count <= 1) {
      throw new Error('Cannot delete the last active vehicle. Archive it instead, or add another vehicle first.')
    }

    // Gather every photo/attachment tied to this vehicle before the cascade
    // delete removes the rows, so the files can be unlinked from disk.
    const q = (sql: string) => (db.prepare(sql).all(id) as { p: string | null }[]).map(r => r.p)
    const photoPaths: (string | null)[] = [
      ...q('SELECT photo AS p FROM vehicles WHERE id = ?'),
      ...q('SELECT receipt_photo AS p FROM fuel_log WHERE vehicle_id = ? AND receipt_photo IS NOT NULL'),
      ...q('SELECT mp.photo_path AS p FROM maintenance_photos mp JOIN maintenance_log ml ON mp.maintenance_id = ml.id WHERE ml.vehicle_id = ?'),
      ...q('SELECT ip.photo_path AS p FROM insurance_photos ip JOIN insurance_policies pol ON ip.policy_id = pol.id WHERE pol.vehicle_id = ?'),
      ...q('SELECT dp.photo_path AS p FROM vehicle_document_photos dp JOIN vehicle_documents d ON dp.document_id = d.id WHERE d.vehicle_id = ?'),
      ...q('SELECT na.file_path AS p FROM note_attachments na JOIN notes n ON na.note_id = n.id WHERE n.vehicle_id = ?'),
      ...q('SELECT ti.photo AS p FROM tire_inspections ti JOIN tire_sets ts ON ti.tire_set_id = ts.id WHERE ts.vehicle_id = ? AND ti.photo IS NOT NULL'),
    ]

    db.prepare('DELETE FROM vehicles WHERE id = ?').run(id)
    deletePhotoFiles(photoPaths)

    // If the deleted vehicle was the active one, switch to another.
    const cvRow = db.prepare("SELECT value FROM settings WHERE key = 'current_vehicle_id'").get() as { value: string } | undefined
    const currentVehicleId = cvRow ? parseInt(cvRow.value, 10) : 0
    if (currentVehicleId === id) {
      const next = db.prepare('SELECT id FROM vehicles WHERE is_archived = 0 ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined
      if (next) {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'current_vehicle_id'").run(String(next.id))
      }
    }
  })

  ipcMain.handle('vehicles:setCurrent', (_, id: number) => {
    const row = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(id) as { id: number } | undefined
    if (!row) throw new Error(`Vehicle ${id} does not exist`)
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('current_vehicle_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(String(id))
  })
}
