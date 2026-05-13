import { createContext, useContext } from 'react'
import type { AppSettings } from '@/types'

export interface SettingsContextValue {
  settings: AppSettings
  refreshSettings: () => Promise<void>
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: { current_odometer: 0, distance_unit: 'km', currency: 'BBD', theme: 'dark' },
  refreshSettings: async () => {},
})

export function useSettings() {
  return useContext(SettingsContext)
}
