import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'

interface SettingRow {
  key: string
  value: string
}

interface VehicleOdometerRow {
  current_odometer: number
}

export function registerSettingsHandlers(): void {
  const db = getDb()

  ipcMain.handle('settings:get', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as SettingRow[]
    const map: Record<string, string> = {}
    for (const row of rows) map[row.key] = row.value

    // current_odometer is computed from the active vehicle, not stored.
    const currentVehicleId = parseInt(map['current_vehicle_id'] ?? '1', 10) || 1
    const vehicle = db.prepare(
      'SELECT current_odometer FROM vehicles WHERE id = ?'
    ).get(currentVehicleId) as VehicleOdometerRow | undefined

    return {
      current_odometer: vehicle?.current_odometer ?? parseFloat(map['current_odometer'] ?? '0'),
      current_vehicle_id: currentVehicleId,
      distance_unit: map['distance_unit'] ?? 'km',
      economy_unit: map['economy_unit'] ?? 'distance',
      currency: map['currency'] ?? 'BBD',
      theme: map['theme'] ?? 'dark',
      notifications_enabled: (map['notifications_enabled'] ?? 'true') === 'true',
      has_seen_welcome: (map['has_seen_welcome'] ?? 'false') === 'true',
    }
  })

  ipcMain.handle('settings:update', (_, settings: Record<string, unknown>) => {
    const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const run = db.transaction((data: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(data)) {
        // current_odometer writes through to the active vehicle's record.
        if (key === 'current_odometer') {
          db.prepare(
            'UPDATE vehicles SET current_odometer = ? WHERE id = ?'
          ).run(Number(value), getCurrentVehicleId())
          continue
        }
        update.run(key, String(value))
      }
    })
    run(settings)
  })
}
