import type {
  FuelEntry, MaintenanceEntry, ServiceInterval, InsurancePolicy,
  Note, AppSettings, DashboardSummary, ExpenseSummary
} from './types'

interface FileDialogOptions {
  filters?: Array<{ name: string; extensions: string[] }>
  multiple?: boolean
}

interface ElectronAPI {
  fuel: {
    getAll: () => Promise<FuelEntry[]>
    add: (entry: Omit<FuelEntry, 'id' | 'created_at'>) => Promise<FuelEntry>
    update: (id: number, entry: Partial<FuelEntry>) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  maintenance: {
    getAll: () => Promise<MaintenanceEntry[]>
    add: (entry: Omit<MaintenanceEntry, 'id' | 'created_at'>) => Promise<MaintenanceEntry>
    update: (id: number, entry: Partial<MaintenanceEntry>) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  schedule: {
    getAll: () => Promise<ServiceInterval[]>
    add: (interval: Omit<ServiceInterval, 'id' | 'next_due_km' | 'km_remaining' | 'status'>) => Promise<ServiceInterval>
    update: (id: number, data: Partial<ServiceInterval>) => Promise<void>
    delete: (id: number) => Promise<void>
    complete: (id: number, odometer: number, date: string) => Promise<void>
  }
  insurance: {
    getAll: () => Promise<InsurancePolicy[]>
    add: (policy: Omit<InsurancePolicy, 'id' | 'created_at'>) => Promise<InsurancePolicy>
    update: (id: number, policy: Partial<InsurancePolicy>) => Promise<void>
    delete: (id: number) => Promise<void>
    deactivate: (id: number) => Promise<void>
  }
  notes: {
    getAll: () => Promise<Note[]>
    search: (query: string) => Promise<Note[]>
    add: (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) => Promise<Note>
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
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
