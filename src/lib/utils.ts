import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'BBD'): string {
  return new Intl.NumberFormat('en-BB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayISO(): string {
  // Local calendar date, not UTC — toISOString() rolls to tomorrow in the
  // evening for negative-UTC timezones and mis-defaults every new record's date.
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Stored consumption = distance driven (in the user's distance unit) per litre.
// Convert/label it to the user's preferred economy readout.
type EconUnit = 'distance' | 'l_per_100km' | 'mpg'

export function economyLabel(distanceUnit: string, economyUnit: EconUnit): string {
  if (economyUnit === 'l_per_100km') return 'L/100km'
  if (economyUnit === 'mpg') return 'mpg'
  return `${distanceUnit}/L`
}

export function economyValue(consumption: number | null | undefined, distanceUnit: string, economyUnit: EconUnit): number | null {
  if (consumption == null || consumption <= 0) return null
  const kmPerL = distanceUnit === 'miles' ? consumption * 1.60934 : consumption
  if (economyUnit === 'l_per_100km') return Math.round((100 / kmPerL) * 10) / 10
  if (economyUnit === 'mpg') {
    const miPerL = distanceUnit === 'miles' ? consumption : consumption / 1.60934
    return Math.round(miPerL * 3.78541 * 10) / 10  // US gallon
  }
  return Math.round(consumption * 100) / 100
}

export function formatEconomy(consumption: number | null | undefined, distanceUnit: string, economyUnit: EconUnit): string | null {
  const v = economyValue(consumption, distanceUnit, economyUnit)
  return v == null ? null : v.toFixed(economyUnit === 'distance' ? 2 : 1)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
