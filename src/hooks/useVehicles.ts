import { createContext, useContext } from 'react'
import type { Vehicle } from '@/types'

export interface VehiclesContextValue {
  vehicles: Vehicle[]
  currentVehicleId: number
  currentVehicle: Vehicle | null
  switchVehicle: (id: number) => Promise<void>
  refreshVehicles: () => Promise<void>
}

export const VehiclesContext = createContext<VehiclesContextValue>({
  vehicles: [],
  currentVehicleId: 1,
  currentVehicle: null,
  switchVehicle: async () => {},
  refreshVehicles: async () => {},
})

export function useVehicles() {
  return useContext(VehiclesContext)
}
