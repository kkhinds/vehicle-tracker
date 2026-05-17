import { useEffect, useState, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import FuelLog from '@/pages/FuelLog'
import Maintenance from '@/pages/Maintenance'
import ServiceSchedule from '@/pages/ServiceSchedule'
import Insurance from '@/pages/Insurance'
import Expenses from '@/pages/Expenses'
import Notes from '@/pages/Notes'
import Settings from '@/pages/Settings'
import Vehicles from '@/pages/Vehicles'
import Tires from '@/pages/Tires'
import Documents from '@/pages/Documents'
import { SettingsContext } from '@/hooks/useSettings'
import { VehiclesContext } from '@/hooks/useVehicles'
import type { AppSettings, Vehicle } from '@/types'

export default function App() {
  const [settings, setSettings] = useState<AppSettings>({
    current_odometer: 0,
    current_vehicle_id: 1,
    distance_unit: 'km',
    currency: 'BBD',
    theme: 'dark',
    notifications_enabled: true,
  })
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  const refreshSettings = useCallback(async () => {
    const s = await window.api.settings.get()
    setSettings(s)
    document.documentElement.classList.toggle('dark', s.theme === 'dark')
  }, [])

  const refreshVehicles = useCallback(async () => {
    const v = await window.api.vehicles.getAll()
    setVehicles(v)
  }, [])

  const switchVehicle = useCallback(async (id: number) => {
    await window.api.vehicles.setCurrent(id)
    await refreshSettings()
    await refreshVehicles()
  }, [refreshSettings, refreshVehicles])

  useEffect(() => {
    refreshSettings()
    refreshVehicles()
  }, [refreshSettings, refreshVehicles])

  const currentVehicle = vehicles.find(v => v.id === settings.current_vehicle_id) ?? null

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings }}>
      <VehiclesContext.Provider value={{
        vehicles,
        currentVehicleId: settings.current_vehicle_id,
        currentVehicle,
        switchVehicle,
        refreshVehicles,
      }}>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/fuel" element={<FuelLog />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/schedule" element={<ServiceSchedule />} />
              <Route path="/tires" element={<Tires />} />
              <Route path="/insurance" element={<Insurance />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </HashRouter>
        <Toaster richColors position="bottom-right" />
      </VehiclesContext.Provider>
    </SettingsContext.Provider>
  )
}
