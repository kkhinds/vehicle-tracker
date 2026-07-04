import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { deletePhotoFiles } from '../photos'

interface PolicyRow {
  id: number
  vehicle_id: number
  provider: string
  policy_number: string
  coverage_type: string
  premium_amount: number
  payment_frequency: string
  start_date: string
  renewal_date: string
  agent_name: string | null
  agent_contact: string | null
  notes: string | null
  is_active: number
  created_at: string
}

interface PhotoRow {
  photo_path: string
}

function getPhotos(db: ReturnType<typeof import('../db').getDb>, policyId: number): string[] {
  return (db.prepare('SELECT photo_path FROM insurance_photos WHERE policy_id = ?').all(policyId) as PhotoRow[])
    .map(r => r.photo_path)
}

export function registerInsuranceHandlers(): void {
  const db = getDb()

  ipcMain.handle('insurance:getAll', () => {
    const vehicleId = getCurrentVehicleId()
    const rows = db.prepare(
      'SELECT * FROM insurance_policies WHERE vehicle_id = ? ORDER BY is_active DESC, renewal_date ASC'
    ).all(vehicleId) as PolicyRow[]
    return rows.map(row => ({ ...row, is_active: row.is_active === 1, photos: getPhotos(db, row.id) }))
  })

  ipcMain.handle('insurance:add', (_, policy: Omit<PolicyRow, 'id' | 'created_at' | 'vehicle_id'> & { photos: string[]; is_active: boolean }) => {
    const vehicleId = getCurrentVehicleId()
    const { photos, ...data } = policy
    const result = db.prepare(`
      INSERT INTO insurance_policies (vehicle_id, provider, policy_number, coverage_type, premium_amount, payment_frequency,
        start_date, renewal_date, agent_name, agent_contact, notes, is_active)
      VALUES (@vehicle_id, @provider, @policy_number, @coverage_type, @premium_amount, @payment_frequency,
        @start_date, @renewal_date, @agent_name, @agent_contact, @notes, @is_active)
    `).run({
      ...data,
      vehicle_id: vehicleId,
      is_active: data.is_active !== false ? 1 : 0,
      agent_name: data.agent_name ?? null,
      agent_contact: data.agent_contact ?? null,
      notes: data.notes ?? null,
    })

    const id = result.lastInsertRowid as number
    const insertPhoto = db.prepare('INSERT INTO insurance_photos (policy_id, photo_path) VALUES (?, ?)')
    for (const photo of photos ?? []) {
      insertPhoto.run(id, photo)
    }

    const row = db.prepare('SELECT * FROM insurance_policies WHERE id = ?').get(id) as PolicyRow
    return { ...row, is_active: row.is_active === 1, photos: getPhotos(db, id) }
  })

  ipcMain.handle('insurance:update', (_, id: number, policy: Partial<PolicyRow & { photos: string[]; is_active: boolean }>) => {
    const current = db.prepare('SELECT * FROM insurance_policies WHERE id = ?').get(id) as PolicyRow
    if (!current) return

    const merged = {
      ...current,
      ...policy,
      is_active: policy.is_active !== undefined ? (policy.is_active ? 1 : 0) : current.is_active
    }

    db.prepare(`
      UPDATE insurance_policies SET provider=@provider, policy_number=@policy_number, coverage_type=@coverage_type,
      premium_amount=@premium_amount, payment_frequency=@payment_frequency, start_date=@start_date,
      renewal_date=@renewal_date, agent_name=@agent_name, agent_contact=@agent_contact, notes=@notes,
      is_active=@is_active WHERE id=@id
    `).run({ ...merged, id })

    if (policy.photos !== undefined) {
      db.prepare('DELETE FROM insurance_photos WHERE policy_id = ?').run(id)
      const insertPhoto = db.prepare('INSERT INTO insurance_photos (policy_id, photo_path) VALUES (?, ?)')
      for (const photo of policy.photos) {
        insertPhoto.run(id, photo)
      }
    }
  })

  ipcMain.handle('insurance:delete', (_, id: number) => {
    const photos = getPhotos(db, id)
    db.prepare('DELETE FROM insurance_policies WHERE id = ?').run(id)
    deletePhotoFiles(photos)
  })

  ipcMain.handle('insurance:deactivate', (_, id: number) => {
    db.prepare('UPDATE insurance_policies SET is_active = 0 WHERE id = ?').run(id)
  })
}
