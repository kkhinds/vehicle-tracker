import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { deletePhotoFiles } from '../photos'

interface DocumentRow {
  id: number
  vehicle_id: number
  doc_type: string
  title: string
  reference_number: string | null
  issuer: string | null
  issued_date: string | null
  expiry_date: string | null
  cost: number | null
  notes: string | null
  created_at: string
}

interface PhotoRow { photo_path: string }

function getPhotos(db: ReturnType<typeof import('../db').getDb>, documentId: number): string[] {
  return (db.prepare('SELECT photo_path FROM vehicle_document_photos WHERE document_id = ?').all(documentId) as PhotoRow[])
    .map(r => r.photo_path)
}

function computeStatus(row: DocumentRow) {
  if (!row.expiry_date) {
    return { days_remaining: null, status: 'no-expiry' as const }
  }
  const now = new Date()
  const expiry = new Date(row.expiry_date)
  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  let status: 'ok' | 'due-soon' | 'overdue' = 'ok'
  if (daysRemaining <= 0) status = 'overdue'
  else if (daysRemaining <= 30) status = 'due-soon'
  return { days_remaining: daysRemaining, status }
}

export function registerDocumentHandlers(): void {
  const db = getDb()

  ipcMain.handle('documents:getAll', () => {
    const vehicleId = getCurrentVehicleId()
    // ORDER BY expiry_date IS NULL puts non-expiring docs at the bottom,
    // then ascending by expiry_date so soonest-to-expire is on top.
    const rows = db.prepare(
      'SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date IS NULL, expiry_date ASC'
    ).all(vehicleId) as DocumentRow[]
    return rows.map(row => ({ ...row, ...computeStatus(row), photos: getPhotos(db, row.id) }))
  })

  ipcMain.handle('documents:add', (_, doc: Omit<DocumentRow, 'id' | 'created_at' | 'vehicle_id'> & { photos: string[] }) => {
    const vehicleId = getCurrentVehicleId()
    const { photos, ...data } = doc
    const result = db.prepare(`
      INSERT INTO vehicle_documents (vehicle_id, doc_type, title, reference_number, issuer,
        issued_date, expiry_date, cost, notes)
      VALUES (@vehicle_id, @doc_type, @title, @reference_number, @issuer,
        @issued_date, @expiry_date, @cost, @notes)
    `).run({
      ...data,
      vehicle_id: vehicleId,
      reference_number: data.reference_number ?? null,
      issuer: data.issuer ?? null,
      issued_date: data.issued_date ?? null,
      cost: data.cost ?? null,
      notes: data.notes ?? null,
    })

    const id = result.lastInsertRowid as number
    const insertPhoto = db.prepare('INSERT INTO vehicle_document_photos (document_id, photo_path) VALUES (?, ?)')
    for (const photo of photos ?? []) {
      insertPhoto.run(id, photo)
    }

    const row = db.prepare('SELECT * FROM vehicle_documents WHERE id = ?').get(id) as DocumentRow
    return { ...row, ...computeStatus(row), photos: getPhotos(db, id) }
  })

  ipcMain.handle('documents:update', (_, id: number, data: Partial<DocumentRow & { photos: string[] }>) => {
    const current = db.prepare('SELECT * FROM vehicle_documents WHERE id = ?').get(id) as DocumentRow
    if (!current) return
    const merged = { ...current, ...data }
    db.prepare(`
      UPDATE vehicle_documents SET doc_type=@doc_type, title=@title, reference_number=@reference_number,
        issuer=@issuer, issued_date=@issued_date, expiry_date=@expiry_date, cost=@cost, notes=@notes
      WHERE id=@id
    `).run({ ...merged, id })

    if (data.photos !== undefined) {
      db.prepare('DELETE FROM vehicle_document_photos WHERE document_id = ?').run(id)
      const insertPhoto = db.prepare('INSERT INTO vehicle_document_photos (document_id, photo_path) VALUES (?, ?)')
      for (const photo of data.photos) {
        insertPhoto.run(id, photo)
      }
    }
  })

  ipcMain.handle('documents:delete', (_, id: number) => {
    const photos = getPhotos(db, id)
    db.prepare('DELETE FROM vehicle_documents WHERE id = ?').run(id)
    deletePhotoFiles(photos)
  })
}
