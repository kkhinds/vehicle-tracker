import { Notification, ipcMain } from 'electron'
import { getDb, getSetting, setSetting } from './db'
import { daysUntil, addMonthsISO } from './dates'

// Scans all non-archived vehicles for upcoming services, insurance renewals,
// and document expiries. Fires native OS notifications for items hitting:
//   - 60/30/7 days for date-based (insurance, documents)
//   - 1000/500/0 km for distance-based (service intervals)
//
// We track which (vehicle_id, item_key, threshold) tuples we've already alerted
// in the `settings` table so a single overdue item doesn't spam the user every
// time they open the app. The dedupe key resets when the underlying item is
// completed/renewed (because the threshold computation changes).

interface VehicleRow { id: number; nickname: string; current_odometer: number }
interface IntervalRow { id: number; name: string; interval_km: number; interval_months: number | null; last_done_km: number | null; last_done_date: string | null }
interface PolicyRow { id: number; provider: string; renewal_date: string }
interface DocumentRow { id: number; title: string; expiry_date: string; doc_type: string }
const DAY_THRESHOLDS = [60, 30, 7, 0]
const KM_THRESHOLDS = [1000, 500, 0]

function pickThreshold(value: number, thresholds: number[]): number | null {
  // thresholds are descending (e.g. [60,30,7,0]); keep the LAST match so we
  // return the smallest bucket crossed, not the first (largest) one. Otherwise
  // an item pings once at the outer bucket and never re-alerts as it closes in.
  let picked: number | null = null
  for (const t of thresholds) {
    if (value <= t) picked = t
  }
  return picked
}

function isNotificationsEnabled(): boolean {
  return (getSetting('notifications_enabled') ?? 'true') === 'true'
}

function getAlertedKeys(): Set<string> {
  const raw = getSetting('alerted_keys')
  if (!raw) return new Set()
  try {
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveAlertedKeys(keys: Set<string>): void {
  setSetting('alerted_keys', JSON.stringify([...keys]))
}

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body, silent: false }).show()
}

export function runNotificationCheck(): { fired: number; checked: number } {
  if (!isNotificationsEnabled()) return { fired: 0, checked: 0 }

  const db = getDb()
  const vehicles = db.prepare(
    'SELECT id, nickname, current_odometer FROM vehicles WHERE is_archived = 0'
  ).all() as VehicleRow[]

  const alerted = getAlertedKeys()
  const stillRelevant = new Set<string>()
  let fired = 0
  let checked = 0

  for (const v of vehicles) {
    // ── Service intervals (km-based, plus time-based when configured)
    const intervals = db.prepare(
      'SELECT id, name, interval_km, interval_months, last_done_km, last_done_date FROM service_intervals WHERE vehicle_id = ?'
    ).all(v.id) as IntervalRow[]

    for (const iv of intervals) {
      checked++

      // Time dimension: fire if the date is due sooner than km.
      if (iv.interval_months && iv.last_done_date) {
        const days = daysUntil(addMonthsISO(iv.last_done_date, iv.interval_months))
        const dt = pickThreshold(days, DAY_THRESHOLDS)
        if (dt !== null) {
          const key = `service-date:${v.id}:${iv.id}:${iv.last_done_date}:${dt}`
          stillRelevant.add(key)
          if (!alerted.has(key)) {
            const verb = days <= 0 ? `overdue by ${Math.abs(days)} day(s)` : `due in ${days} day(s)`
            notify(`${v.nickname}: ${iv.name}`, `Service ${verb}.`)
            alerted.add(key)
            fired++
          }
        }
      }

      const dueKm = (iv.last_done_km ?? 0) + iv.interval_km
      const remaining = dueKm - v.current_odometer
      const threshold = pickThreshold(remaining, KM_THRESHOLDS)
      if (threshold === null) continue

      const key = `service:${v.id}:${iv.id}:${iv.last_done_km ?? 0}:${threshold}`
      stillRelevant.add(key)
      if (alerted.has(key)) continue

      const verb = remaining <= 0 ? `overdue by ${Math.abs(Math.round(remaining))} km` : `due in ${Math.round(remaining)} km`
      notify(`${v.nickname}: ${iv.name}`, `Service ${verb}.`)
      alerted.add(key)
      fired++
    }

    // ── Insurance renewals (day-based)
    const policies = db.prepare(
      'SELECT id, provider, renewal_date FROM insurance_policies WHERE vehicle_id = ? AND is_active = 1'
    ).all(v.id) as PolicyRow[]

    for (const p of policies) {
      checked++
      const days = daysUntil(p.renewal_date)
      const threshold = pickThreshold(days, DAY_THRESHOLDS)
      if (threshold === null) continue

      const key = `insurance:${v.id}:${p.id}:${p.renewal_date}:${threshold}`
      stillRelevant.add(key)
      if (alerted.has(key)) continue

      const verb = days <= 0 ? `expired ${Math.abs(days)} day(s) ago` : `renews in ${days} day(s)`
      notify(`${v.nickname}: Insurance ${verb}`, `${p.provider} policy.`)
      alerted.add(key)
      fired++
    }

    // ── Documents (day-based). Skip non-expiring docs (NULL expiry).
    const documents = db.prepare(
      'SELECT id, title, expiry_date, doc_type FROM vehicle_documents WHERE vehicle_id = ? AND expiry_date IS NOT NULL'
    ).all(v.id) as DocumentRow[]

    for (const d of documents) {
      checked++
      const days = daysUntil(d.expiry_date)
      const threshold = pickThreshold(days, DAY_THRESHOLDS)
      if (threshold === null) continue

      const key = `document:${v.id}:${d.id}:${d.expiry_date}:${threshold}`
      stillRelevant.add(key)
      if (alerted.has(key)) continue

      const verb = days <= 0 ? `expired ${Math.abs(days)} day(s) ago` : `expires in ${days} day(s)`
      notify(`${v.nickname}: ${d.title} ${verb}`, `${d.doc_type.replace(/-/g, ' ')}.`)
      alerted.add(key)
      fired++
    }
  }

  // Prune alerted keys that no longer apply (item was completed, renewed, etc.)
  const pruned = new Set([...alerted].filter(k => stillRelevant.has(k)))
  saveAlertedKeys(pruned)

  return { fired, checked }
}

export function registerNotificationHandlers(): void {
  ipcMain.handle('notifications:check', () => runNotificationCheck())
  ipcMain.handle('notifications:test', () => {
    notify('Vehicle Tracker', 'Test notification — system notifications are working.')
    return true
  })
}

// Run a check shortly after app start, then daily.
export function startNotificationScheduler(): void {
  // Initial check after 10 seconds (let UI finish loading first).
  setTimeout(() => {
    try { runNotificationCheck() } catch (e) { console.error('notification check failed', e) }
  }, 10_000)
  // Daily check (every 24 hours while the app is open).
  setInterval(() => {
    try { runNotificationCheck() } catch (e) { console.error('notification check failed', e) }
  }, 24 * 60 * 60 * 1000)
}
