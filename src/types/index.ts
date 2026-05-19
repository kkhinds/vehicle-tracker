export const DRIVETRAINS = [
  'petrol-na',
  'petrol-turbo',
  'diesel',
  'hybrid',
  'ev',
] as const
export type Drivetrain = (typeof DRIVETRAINS)[number]

export const DRIVETRAIN_LABELS: Record<Drivetrain, string> = {
  'petrol-na': 'Petrol (Naturally Aspirated)',
  'petrol-turbo': 'Petrol (Turbocharged)',
  'diesel': 'Diesel',
  'hybrid': 'Hybrid',
  'ev': 'Electric',
}

export interface Vehicle {
  id: number
  nickname: string
  make: string
  model: string
  year: number
  trim: string | null
  drivetrain: Drivetrain
  vin: string | null
  license_plate: string | null
  color: string | null
  photo: string | null
  purchase_date: string | null
  purchase_odometer: number | null
  current_odometer: number
  is_archived: boolean
  created_at: string
}

export interface FuelEntry {
  id: number
  vehicle_id: number
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
  vehicle_id: number
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
  vehicle_id: number
  name: string
  category_key: string | null
  interval_km: number
  last_done_km: number | null
  last_done_date: string | null
  is_custom: boolean
  consequence_of_skipping: string | null
  notes: string | null
  // Computed fields added by handler
  next_due_km?: number
  km_remaining?: number
  status?: 'ok' | 'due-soon' | 'overdue'
}

export interface InsurancePolicy {
  id: number
  vehicle_id: number
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
  vehicle_id: number | null
  title: string
  body: string | null
  date: string
  attachments: string[]
  created_at: string
  updated_at: string
}

export const DOCUMENT_TYPES = [
  'registration',
  'road-tax',
  'inspection',
  'warranty',
  'roadside-assistance',
  'drivers-license',
  'other',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  'registration': 'Registration',
  'road-tax': 'Road Tax',
  'inspection': 'Inspection Certificate',
  'warranty': 'Warranty',
  'roadside-assistance': 'Roadside Assistance',
  'drivers-license': "Driver's License",
  'other': 'Other',
}

export interface VehicleDocument {
  id: number
  vehicle_id: number
  doc_type: DocumentType
  title: string
  reference_number: string | null
  issuer: string | null
  issued_date: string | null
  expiry_date: string | null  // null = doesn't expire (warranty for life, etc.)
  cost: number | null
  notes: string | null
  photos: string[]
  created_at: string
  // Computed
  days_remaining?: number | null
  status?: 'ok' | 'due-soon' | 'overdue' | 'no-expiry'
}

export const TIRE_POSITIONS = ['FL', 'FR', 'RL', 'RR', 'SPARE'] as const
export type TirePosition = (typeof TIRE_POSITIONS)[number]

export interface TireSet {
  id: number
  vehicle_id: number
  brand: string
  model: string
  size: string  // e.g. "265/65R17"
  dot_date: string | null    // YYYY-MM (week/year)
  install_date: string
  install_odometer: number
  retired_date: string | null
  retired_odometer: number | null
  recommended_psi_front: number | null
  recommended_psi_rear: number | null
  notes: string | null
  created_at: string
  // Computed
  age_years?: number
  is_active?: boolean
}

export interface TireInspection {
  id: number
  tire_set_id: number
  date: string
  odometer: number
  // Tread depth per corner (mm); null if not measured
  tread_fl: number | null
  tread_fr: number | null
  tread_rl: number | null
  tread_rr: number | null
  // Pressure per corner (PSI)
  pressure_fl: number | null
  pressure_fr: number | null
  pressure_rl: number | null
  pressure_rr: number | null
  notes: string | null
  photo: string | null
  created_at: string
}

export interface TireRotation {
  id: number
  tire_set_id: number
  date: string
  odometer: number
  pattern: 'front-to-back' | 'cross' | 'x-pattern' | 'side-to-side' | 'other'
  notes: string | null
  created_at: string
}

export interface AppSettings {
  current_odometer: number  // kept for backward compat; mirrors current vehicle's odometer
  current_vehicle_id: number
  distance_unit: 'km' | 'miles'
  currency: string
  theme: 'dark' | 'light'
  notifications_enabled: boolean
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
  upcomingDocument: {
    title: string
    docType: DocumentType
    daysRemaining: number
    expiryDate: string
    documentId: number
  } | null
  tireWarning: {
    tireSetId: number
    reason: string
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
