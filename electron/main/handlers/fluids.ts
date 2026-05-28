import { ipcMain } from 'electron'
import { getDb, getCurrentVehicleId } from '../db'
import { FLUID_PRESETS, getFluidsForDrivetrain, findFluidPreset } from '../presets/fluids'

interface FluidRow {
  id: number
  vehicle_id: number
  date: string
  odometer: number
  fluid_type: string
  amount: number
  unit: string
  notes: string | null
  created_at: string
}

interface VehicleRow { drivetrain: string; current_odometer: number }

// Convert any amount to a normalized "ml" value for cross-unit aggregation.
function toMl(amount: number, unit: string): number {
  switch (unit) {
    case 'L': return amount * 1000
    case 'oz': return amount * 29.5735
    case 'ml':
    default: return amount
  }
}

// Convert ml back to the preset's display unit for the rate/total.
function fromMl(ml: number, unit: string): number {
  switch (unit) {
    case 'L': return ml / 1000
    case 'oz': return ml / 29.5735
    case 'ml':
    default: return ml
  }
}

/**
 * Compute consumption rate (in the preset's unit) per 1000 km, based on
 * top-ups in the last 12 months and the km driven over that window.
 * Returns null if there aren't enough data points to be meaningful.
 */
function computeRate(
  rows: FluidRow[],
  presetUnit: string,
  currentOdometer: number,
): number | null {
  if (rows.length === 0) return null

  // Use the oldest top-up's odometer as the baseline. Need at least two
  // odometer reference points (oldest top-up odometer + current odometer)
  // and a meaningful distance.
  const sorted = [...rows].sort((a, b) => a.odometer - b.odometer)
  const oldest = sorted[0]
  const kmSpan = currentOdometer - oldest.odometer
  if (kmSpan < 500) return null  // not enough driving yet to call it

  const totalMl = rows.reduce((sum, r) => sum + toMl(r.amount, r.unit), 0)
  const mlPer1000Km = (totalMl / kmSpan) * 1000
  return fromMl(mlPer1000Km, presetUnit)
}

export function registerFluidHandlers(): void {
  const db = getDb()

  /** Returns presets relevant to the current vehicle's drivetrain. */
  ipcMain.handle('fluids:getPresets', () => {
    const vehicleId = getCurrentVehicleId()
    const vehicle = db.prepare(
      'SELECT drivetrain, current_odometer FROM vehicles WHERE id = ?'
    ).get(vehicleId) as VehicleRow | undefined
    const relevant = vehicle ? getFluidsForDrivetrain(vehicle.drivetrain) : FLUID_PRESETS
    const relevantKeys = new Set(relevant.map(f => f.key))

    return FLUID_PRESETS.map(p => ({
      key: p.key,
      label: p.label,
      unit: p.unit,
      warnPerThousandKm: p.warnPerThousandKm,
      meaning: p.meaning,
      relevant: relevantKeys.has(p.key),
    }))
  })

  ipcMain.handle('fluids:getAll', () => {
    const vehicleId = getCurrentVehicleId()
    const rows = db.prepare(
      'SELECT * FROM fluid_topups WHERE vehicle_id = ? ORDER BY date DESC, id DESC'
    ).all(vehicleId) as FluidRow[]
    return rows
  })

  ipcMain.handle('fluids:add', (_, entry: Omit<FluidRow, 'id' | 'created_at' | 'vehicle_id'>) => {
    const vehicleId = getCurrentVehicleId()
    const result = db.prepare(`
      INSERT INTO fluid_topups (vehicle_id, date, odometer, fluid_type, amount, unit, notes)
      VALUES (@vehicle_id, @date, @odometer, @fluid_type, @amount, @unit, @notes)
    `).run({
      ...entry,
      vehicle_id: vehicleId,
      notes: entry.notes ?? null,
    })

    // Bump the vehicle's odometer if the top-up reading is newer.
    db.prepare(
      'UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?'
    ).run(entry.odometer, vehicleId)

    return db.prepare('SELECT * FROM fluid_topups WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('fluids:update', (_, id: number, data: Partial<FluidRow>) => {
    const current = db.prepare('SELECT * FROM fluid_topups WHERE id = ?').get(id) as FluidRow
    if (!current) return
    const merged = { ...current, ...data }
    db.prepare(`
      UPDATE fluid_topups SET date=@date, odometer=@odometer, fluid_type=@fluid_type,
        amount=@amount, unit=@unit, notes=@notes WHERE id=@id
    `).run({ ...merged, id })
  })

  ipcMain.handle('fluids:delete', (_, id: number) => {
    db.prepare('DELETE FROM fluid_topups WHERE id = ?').run(id)
  })

  /** Per-fluid stats for the current vehicle (used by the Fluids page). */
  ipcMain.handle('fluids:getStats', () => {
    const vehicleId = getCurrentVehicleId()
    const vehicle = db.prepare(
      'SELECT drivetrain, current_odometer FROM vehicles WHERE id = ?'
    ).get(vehicleId) as VehicleRow | undefined
    if (!vehicle) return []

    const allRows = db.prepare(
      'SELECT * FROM fluid_topups WHERE vehicle_id = ? ORDER BY date DESC'
    ).all(vehicleId) as FluidRow[]

    const relevant = getFluidsForDrivetrain(vehicle.drivetrain)
    const relevantKeys = new Set(relevant.map(f => f.key))

    // Always include any fluid the user has actually logged, even if it's
    // not in the drivetrain's "relevant" set — they had a reason.
    const fluidKeys = new Set<string>([
      ...relevantKeys,
      ...allRows.map(r => r.fluid_type),
    ])

    return Array.from(fluidKeys).map(key => {
      const preset = findFluidPreset(key)
      const rows = allRows.filter(r => r.fluid_type === key)
      const totalMl = rows.reduce((sum, r) => sum + toMl(r.amount, r.unit), 0)
      const total = preset ? fromMl(totalMl, preset.unit) : totalMl
      const last = rows[0] ? {
        date: rows[0].date,
        amount: rows[0].amount,
        odometer: rows[0].odometer,
      } : null
      const rate = preset
        ? computeRate(rows, preset.unit, vehicle.current_odometer)
        : null
      const exceeds = preset && rate !== null
        ? rate > preset.warnPerThousandKm
        : false

      return {
        preset: preset
          ? {
              key: preset.key,
              label: preset.label,
              unit: preset.unit,
              warnPerThousandKm: preset.warnPerThousandKm,
              meaning: preset.meaning,
              relevant: relevantKeys.has(preset.key),
            }
          : {
              key,
              label: key,
              unit: 'ml' as const,
              warnPerThousandKm: 99999,
              meaning: '',
              relevant: false,
            },
        entries: rows.length,
        totalAmount: Math.round(total * 100) / 100,
        lastTopup: last,
        consumptionPer1000Km: rate !== null ? Math.round(rate * 10) / 10 : null,
        exceedsThreshold: exceeds,
      }
    })
      .sort((a, b) => {
        // Show exceeded → has entries → relevant → alphabetic
        if (a.exceedsThreshold !== b.exceedsThreshold) return a.exceedsThreshold ? -1 : 1
        if ((a.entries > 0) !== (b.entries > 0)) return a.entries > 0 ? -1 : 1
        if (a.preset.relevant !== b.preset.relevant) return a.preset.relevant ? -1 : 1
        return a.preset.label.localeCompare(b.preset.label)
      })
  })

  /**
   * The single most-concerning fluid for the dashboard, if any. Returns
   * the first fluid whose consumption exceeds threshold AND has been
   * logged at least twice (a single top-up doesn't establish a trend).
   */
  ipcMain.handle('fluids:getDashboardWarning', () => {
    const vehicleId = getCurrentVehicleId()
    const vehicle = db.prepare(
      'SELECT drivetrain, current_odometer FROM vehicles WHERE id = ?'
    ).get(vehicleId) as VehicleRow | undefined
    if (!vehicle) return null

    const rows = db.prepare(
      'SELECT * FROM fluid_topups WHERE vehicle_id = ?'
    ).all(vehicleId) as FluidRow[]

    for (const preset of FLUID_PRESETS) {
      const fluidRows = rows.filter(r => r.fluid_type === preset.key)
      if (fluidRows.length < 2) continue
      const rate = computeRate(fluidRows, preset.unit, vehicle.current_odometer)
      if (rate === null) continue
      if (rate > preset.warnPerThousandKm) {
        return {
          fluidKey: preset.key,
          fluidLabel: preset.label,
          reason: `${rate.toFixed(1)} ${preset.unit}/1000 km — above the ${preset.warnPerThousandKm} ${preset.unit} threshold. ${preset.meaning}`,
        }
      }
    }
    return null
  })
}
