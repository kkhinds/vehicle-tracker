import { ipcMain } from 'electron'
import { getDb } from '../db'

interface MaintenanceRow {
  id: number
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

function getPhotos(db: ReturnType<typeof import('../db').getDb>, maintenanceId: number): string[] {
  return (db.prepare('SELECT photo_path FROM maintenance_photos WHERE maintenance_id = ?').all(maintenanceId) as PhotoRow[])
    .map(r => r.photo_path)
}

export function registerMaintenanceHandlers(): void {
  const db = getDb()

  ipcMain.handle('maintenance:getAll', () => {
    const rows = db.prepare('SELECT * FROM maintenance_log ORDER BY date DESC, id DESC').all() as MaintenanceRow[]
    return rows.map(row => ({ ...row, photos: getPhotos(db, row.id) }))
  })

  ipcMain.handle('maintenance:add', (_, entry: Omit<MaintenanceRow, 'id' | 'created_at'> & { photos: string[] }) => {
    const { photos, ...data } = entry
    const result = db.prepare(`
      INSERT INTO maintenance_log (date, odometer, category, description, cost, shop_name, parts_replaced, notes)
      VALUES (@date, @odometer, @category, @description, @cost, @shop_name, @parts_replaced, @notes)
    `).run({
      ...data,
      shop_name: data.shop_name ?? null,
      parts_replaced: data.parts_replaced ?? null,
      notes: data.notes ?? null,
    })

    const id = result.lastInsertRowid as number
    const insertPhoto = db.prepare('INSERT INTO maintenance_photos (maintenance_id, photo_path) VALUES (?, ?)')
    for (const photo of photos ?? []) {
      insertPhoto.run(id, photo)
    }

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
      db.prepare('DELETE FROM maintenance_photos WHERE maintenance_id = ?').run(id)
      const insertPhoto = db.prepare('INSERT INTO maintenance_photos (maintenance_id, photo_path) VALUES (?, ?)')
      for (const photo of entry.photos) {
        insertPhoto.run(id, photo)
      }
    }
  })

  ipcMain.handle('maintenance:delete', (_, id: number) => {
    db.prepare('DELETE FROM maintenance_log WHERE id = ?').run(id)
  })
}
