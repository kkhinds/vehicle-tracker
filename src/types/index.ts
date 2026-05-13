export interface FuelEntry {
  id: number
  date: string
  odometer: number
  litres: number
  cost_per_litre: number
  total_cost: number
  fuel_station: string | null
  full_tank: boolean
  notes: string | null
  receipt_photo: string | null
  consumption: number | null
  created_at: string
}

export interface MaintenanceEntry {
  id: number
  date: string
  odometer: number
  category: string
  description: string
  cost: number
  shop_name: string | null
  parts_replaced: string | null
  notes: string | null
  photos: string[]
  created_at: string
}

export const MAINTENANCE_CATEGORIES = [
  'Oil Change',
  'Tyre Rotation',
  'Brake Service',
  'Filter Replacement',
  'Battery',
  'Suspension',
  'Electrical',
  'Body Work',
  'Windshield/Glass',
  'AC Service',
  'Wheel Alignment',
  'Detailing',
  'Other',
] as const

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number]

export interface ServiceInterval {
  id: number
  name: string
  interval_km: number
  last_done_km: number | null
  last_done_date: string | null
  is_custom: boolean
  notes: string | null
  // Computed fields added by handler
  next_due_km?: number
  km_remaining?: number
  status?: 'ok' | 'due-soon' | 'overdue'
}

export interface InsurancePolicy {
  id: number
  provider: string
  policy_number: string
  coverage_type: 'comprehensive' | 'third-party' | 'third-party-fire-theft'
  premium_amount: number
  payment_frequency: 'monthly' | 'quarterly' | 'annually'
  start_date: string
  renewal_date: string
  agent_name: string | null
  agent_contact: string | null
  notes: string | null
  is_active: boolean
  photos: string[]
  created_at: string
}

export interface Note {
  id: number
  title: string
  body: string | null
  date: string
  attachments: string[]
  created_at: string
  updated_at: string
}

export interface AppSettings {
  current_odometer: number
  distance_unit: 'km' | 'miles'
  currency: string
  theme: 'dark' | 'light'
}

export interface ActivityEntry {
  id: number
  type: 'fuel' | 'maintenance' | 'insurance' | 'note'
  date: string
  description: string
  amount?: number
}

export interface MonthlyTrendEntry {
  month: string   // 'YYYY-MM'
  label: string   // 'Jan 24'
  fuel: number
  maintenance: number
  insurance: number
  other: number
  total: number
}

export interface DashboardSummary {
  monthlyFuelCost: number
  avgConsumption: number | null
  nextService: {
    name: string
    kmRemaining: number
    dueKm: number
  } | null
  insuranceRenewal: {
    provider: string
    daysRemaining: number
    renewalDate: string
    policyId: number
  } | null
  recentActivity: ActivityEntry[]
  totalCost: number
  monthlyTrend: MonthlyTrendEntry[]
}

export interface ExpenseSummary {
  byCategory: { category: string; amount: number; color: string }[]
  monthlyTrend: MonthlyTrendEntry[]
  totalCost: number
  quarterly: { quarter: string; amount: number }[]
  yearly: { year: string; amount: number }[]
}
