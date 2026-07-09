import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { detectIntervalKey } from '../presets/serviceIntervals'
import { deletePhotoFiles, replaceChildPaths } from '../photos'

interface MaintenanceRow {
  id: number
  vehicle_id: number
  date: string
  odometer: number
  category: string
  description: string
  cost: number
  shop_name: string | null
  parts_replaced: string | null
  notes: string | null
  created_at: string
}

interface PhotoRow {
  photo_path: string
}

interface IntervalLite {
  id: number
  name: string
  category_key: string | null
}

function getPhotos(db: ReturnType<typeof import('../db').getDb>, maintenanceId: number): string[] {
  return (db.prepare('SELECT photo_path FROM maintenance_photos WHERE maintenance_id = ?').all(maintenanceId) as PhotoRow[])
    .map(r => r.photo_path)
}

export function registerMaintenanceHandlers(): void {
  const db = getDb()

  ipcMain.handle('maintenance:getAll', () => {
    const vehicleId = getCurrentVehicleId()
    const rows = db.prepare(
      'SELECT * FROM maintenance_log WHERE vehicle_id = ? ORDER BY date DESC, id DESC'
    ).all(vehicleId) as MaintenanceRow[]
    return rows.map(row => ({ ...row, photos: getPhotos(db, row.id) }))
  })

  ipcMain.handle('maintenance:add', (_, entry: Omit<MaintenanceRow, 'id' | 'created_at' | 'vehicle_id'> & { photos: string[] }) => {
    const vehicleId = getCurrentVehicleId()
    const { photos, ...data } = entry
    const result = db.prepare(`
      INSERT INTO maintenance_log (vehicle_id, date, odometer, category, description, cost, shop_name, parts_replaced, notes)
      VALUES (@vehicle_id, @date, @odometer, @category, @description, @cost, @shop_name, @parts_replaced, @notes)
    `).run({
      ...data,
      vehicle_id: vehicleId,
      shop_name: data.shop_name ?? null,
      parts_replaced: data.parts_replaced ?? null,
      notes: data.notes ?? null,
    })

    const id = result.lastInsertRowid as number
    const insertPhoto = db.prepare('INSERT INTO maintenance_photos (maintenance_id, photo_path) VALUES (?, ?)')
    for (const photo of photos ?? []) {
      insertPhoto.run(id, photo)
    }

    // Bump the vehicle's current_odometer if newer.
    db.prepare(
      'UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?'
    ).run(data.odometer, vehicleId)

    const row = db.prepare('SELECT * FROM maintenance_log WHERE id = ?').get(id) as MaintenanceRow
    return { ...row, photos: getPhotos(db, id) }
  })

  ipcMain.handle('maintenance:update', (_, id: number, entry: Partial<MaintenanceRow & { photos: string[] }>) => {
    const current = db.prepare('SELECT * FROM maintenance_log WHERE id = ?').get(id) as MaintenanceRow
    if (!current) return

    const merged = { ...current, ...entry }
    db.prepare(`
      UPDATE maintenance_log SET date=@date, odometer=@odometer, category=@category, description=@description,
      cost=@cost, shop_name=@shop_name, parts_replaced=@parts_replaced, notes=@notes WHERE id=@id
    `).run({ ...merged, id })

    if (entry.photos !== undefined) {
      replaceChildPaths(db, 'maintenance_photos', 'maintenance_id', id, 'photo_path', entry.photos)
    }
  })

  ipcMain.handle('maintenance:delete', (_, id: number) => {
    const photos = getPhotos(db, id)
    db.prepare('DELETE FROM maintenance_log WHERE id = ?').run(id)
    deletePhotoFiles(photos)
  })

  /**
   * Auto-link: given a category + description, find a matching service interval
   * for the current vehicle. Returns null if no match.
   *
   * Used by the maintenance form to prompt "Mark X as done at Y km on Z?" right
   * after the user logs a service. One-click eliminates the double-entry problem.
   */
  ipcMain.handle('maintenance:findMatchingInterval', (_, category: string, description: string) => {
    const vehicleId = getCurrentVehicleId()
    const key = detectIntervalKey(category, description)
    if (!key) return null

    const interval = db.prepare(
      'SELECT id, name, category_key FROM service_intervals WHERE vehicle_id = ? AND category_key = ? LIMIT 1'
    ).get(vehicleId, key) as IntervalLite | undefined

    return interval ?? null
  })
}
