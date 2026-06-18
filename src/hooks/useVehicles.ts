import { createContext, useContext } from 'react'
import type { Vehicle } from '@/types'

export interface VehiclesContextValue {
  vehicles: Vehicle[]
  currentVehicleId: number
  currentVehicle: Vehicle | null
  switchVehicle: (id: number) => Promise<void>
  refreshVehicles: () => Promise<void>
}

export const VehiclesContext = createContext<VehiclesContextValue | null>(null)

export function useVehicles(): VehiclesContextValue {
  const ctx = useContext(VehiclesContext)
  if (!ctx) throw new Error('useVehicles must be used inside <VehiclesContext.Provider>')
  return ctx
}
