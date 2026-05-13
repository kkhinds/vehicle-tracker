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
import { SettingsContext } from '@/hooks/useSettings'
import type { AppSettings } from '@/types'

export default function App() {
  const [settings, setSettings] = useState<AppSettings>({
    current_odometer: 0,
    distance_unit: 'km',
    currency: 'BBD',
    theme: 'dark',
  })

  const refreshSettings = useCallback(async () => {
    const s = await window.api.settings.get()
    setSettings(s)
    // Apply theme to <html>
    document.documentElement.classList.toggle('dark', s.theme === 'dark')
  }, [])

  useEffect(() => {
    refreshSettings()
  }, [refreshSettings])

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings }}>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/fuel" element={<FuelLog />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/schedule" element={<ServiceSchedule />} />
            <Route path="/insurance" element={<Insurance />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </HashRouter>
      <Toaster richColors position="bottom-right" />
    </SettingsContext.Provider>
  )
}
