import { useEffect, useState, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppShell from '@/components/shell/AppShell'
import WelcomeDialog from '@/components/shared/WelcomeDialog'
import { SettingsContext } from '@/hooks/useSettings'
import { VehiclesContext } from '@/hooks/useVehicles'
import type { AppSettings, Vehicle } from '@/types'

export default function App() {
  const [settings, setSettings] = useState<AppSettings>({
    current_odometer: 0,
    current_vehicle_id: 1,
    distance_unit: 'km',
    economy_unit: 'distance',
    currency: 'BBD',
    theme: 'dark',
    notifications_enabled: true,
    has_seen_welcome: false,
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

  async function dismissWelcome() {
    await window.api.settings.update({ has_seen_welcome: true })
    await refreshSettings()
  }

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
          <Routes>
            <Route path="/" element={<AppShell />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
        <Toaster richColors position="bottom-right" />
        <WelcomeDialog open={!settings.has_seen_welcome} onDismiss={dismissWelcome} />
      </VehiclesContext.Provider>
    </SettingsContext.Provider>
  )
}
