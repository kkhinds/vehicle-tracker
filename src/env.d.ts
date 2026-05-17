import type {
  Vehicle, FuelEntry, MaintenanceEntry, ServiceInterval, InsurancePolicy,
  Note, AppSettings, DashboardSummary, ExpenseSummary,
  TireSet, TireInspection, TireRotation, VehicleDocument
} from './types'

interface FileDialogOptions {
  filters?: Array<{ name: string; extensions: string[] }>
  multiple?: boolean
}

interface IntervalMatch {
  id: number
  name: string
  category_key: string | null
}

interface NotificationCheckResult {
  fired: number
  checked: number
}

interface ElectronAPI {
  vehicles: {
    getAll: () => Promise<Vehicle[]>
    get: (id: number) => Promise<Vehicle | null>
    add: (vehicle: Omit<Vehicle, 'id' | 'created_at'>) => Promise<Vehicle>
    update: (id: number, data: Partial<Vehicle>) => Promise<void>
    delete: (id: number) => Promise<void>
    setCurrent: (id: number) => Promise<void>
  }
  fuel: {
    getAll: () => Promise<FuelEntry[]>
    add: (entry: Omit<FuelEntry, 'id' | 'created_at' | 'vehicle_id'>) => Promise<FuelEntry>
    update: (id: number, entry: Partial<FuelEntry>) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  maintenance: {
    getAll: () => Promise<MaintenanceEntry[]>
    add: (entry: Omit<MaintenanceEntry, 'id' | 'created_at' | 'vehicle_id'>) => Promise<MaintenanceEntry>
    update: (id: number, entry: Partial<MaintenanceEntry>) => Promise<void>
    delete: (id: number) => Promise<void>
    findMatchingInterval: (category: string, description: string) => Promise<IntervalMatch | null>
  }
  schedule: {
    getAll: () => Promise<ServiceInterval[]>
    add: (interval: Omit<ServiceInterval, 'id' | 'vehicle_id' | 'next_due_km' | 'km_remaining' | 'status'>) => Promise<ServiceInterval>
    update: (id: number, data: Partial<ServiceInterval>) => Promise<void>
    delete: (id: number) => Promise<void>
    complete: (id: number, odometer: number, date: string) => Promise<void>
    markDone: (id: number, odometer: number, date: string) => Promise<void>
  }
  insurance: {
    getAll: () => Promise<InsurancePolicy[]>
    add: (policy: Omit<InsurancePolicy, 'id' | 'created_at' | 'vehicle_id'>) => Promise<InsurancePolicy>
    update: (id: number, policy: Partial<InsurancePolicy>) => Promise<void>
    delete: (id: number) => Promise<void>
    deactivate: (id: number) => Promise<void>
  }
  notes: {
    getAll: () => Promise<Note[]>
    search: (query: string) => Promise<Note[]>
    add: (note: Omit<Note, 'id' | 'created_at' | 'updated_at' | 'vehicle_id'> & { vehicle_id?: number | null }) => Promise<Note>
    update: (id: number, note: Partial<Note>) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (settings: Partial<AppSettings>) => Promise<void>
  }
  files: {
    openDialog: (options: FileDialogOptions) => Promise<string[]>
    savePhoto: (sourcePath: string, category: string) => Promise<string>
    deleteFile: (filePath: string) => Promise<void>
    getImageData: (filePath: string) => Promise<string | null>
    openFile: (filePath: string) => Promise<void>
    getLocalFileUrl: (filePath: string) => string
  }
  dashboard: {
    getSummary: () => Promise<DashboardSummary>
  }
  expenses: {
    getSummary: (startDate?: string, endDate?: string) => Promise<ExpenseSummary>
    exportCsv: (startDate?: string, endDate?: string, category?: string) => Promise<string>
  }
  tires: {
    getSets: () => Promise<TireSet[]>
    addSet: (set: Omit<TireSet, 'id' | 'created_at' | 'vehicle_id' | 'age_years' | 'is_active'>) => Promise<TireSet>
    updateSet: (id: number, data: Partial<TireSet>) => Promise<void>
    deleteSet: (id: number) => Promise<void>
    retireSet: (id: number, date: string, odometer: number) => Promise<void>
    getInspections: (tireSetId: number) => Promise<TireInspection[]>
    addInspection: (inspection: Omit<TireInspection, 'id' | 'created_at'>) => Promise<TireInspection>
    deleteInspection: (id: number) => Promise<void>
    getRotations: (tireSetId: number) => Promise<TireRotation[]>
    addRotation: (rotation: Omit<TireRotation, 'id' | 'created_at'>) => Promise<TireRotation>
    deleteRotation: (id: number) => Promise<void>
  }
  documents: {
    getAll: () => Promise<VehicleDocument[]>
    add: (doc: Omit<VehicleDocument, 'id' | 'created_at' | 'vehicle_id' | 'days_remaining' | 'status'>) => Promise<VehicleDocument>
    update: (id: number, data: Partial<VehicleDocument>) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  notifications: {
    check: () => Promise<NotificationCheckResult>
    test: () => Promise<boolean>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
