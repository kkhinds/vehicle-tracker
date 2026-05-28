import { createContext, useContext } from 'react'
import type { AppSettings } from '@/types'

export interface SettingsContextValue {
  settings: AppSettings
  refreshSettings: () => Promise<void>
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: {
    current_odometer: 0,
    current_vehicle_id: 1,
    distance_unit: 'km',
    currency: 'BBD',
    theme: 'dark',
    notifications_enabled: true,
    has_seen_welcome: false,
  },
  refreshSettings: async () => {},
})

export function useSettings() {
  return useContext(SettingsContext)
}
