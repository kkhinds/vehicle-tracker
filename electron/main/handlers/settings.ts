import { ipcMain } from 'electron'
import { getDb } from '../db'

interface SettingRow {
  key: string
  value: string
}

export function registerSettingsHandlers(): void {
  const db = getDb()

  ipcMain.handle('settings:get', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as SettingRow[]
    const map: Record<string, string> = {}
    for (const row of rows) map[row.key] = row.value
    return {
      current_odometer: parseFloat(map['current_odometer'] ?? '0'),
      distance_unit: map['distance_unit'] ?? 'km',
      currency: map['currency'] ?? 'BBD',
      theme: map['theme'] ?? 'dark',
    }
  })

  ipcMain.handle('settings:update', (_, settings: Record<string, unknown>) => {
    const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const run = db.transaction((data: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(data)) {
        update.run(key, String(value))
      }
    })
    run(settings)
  })
}
