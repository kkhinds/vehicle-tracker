import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Sun, Moon, Bell, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { DRIVETRAIN_LABELS } from '@/types'

const schema = z.object({
  current_odometer: z.coerce.number().min(0),
  distance_unit: z.enum(['km', 'miles']),
  currency: z.string().min(1),
  theme: z.enum(['dark', 'light']),
  notifications_enabled: z.boolean(),
})
type FormData = z.infer<typeof schema>

export default function Settings() {
  const { settings, refreshSettings } = useSettings()
  const { currentVehicle } = useVehicles()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: settings,
  })

  useEffect(() => {
    reset(settings)
  }, [settings, reset])

  const theme = watch('theme')
  const distanceUnit = watch('distance_unit')
  const notificationsEnabled = watch('notifications_enabled')

  async function onSubmit(data: FormData) {
    await window.api.settings.update(data)
    await refreshSettings()
    document.documentElement.classList.toggle('dark', data.theme === 'dark')
    toast.success('Settings saved')
  }

  async function testNotification() {
    const ok = await window.api.notifications.test()
    if (ok) toast.success('Test notification sent — check your system notifications')
  }

  async function runCheck() {
    const r = await window.api.notifications.check()
    toast.success(`Checked ${r.checked} items, fired ${r.fired} notification(s)`)
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">App-wide preferences</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Current vehicle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Vehicle</CardTitle>
            <CardDescription>Odometer and units apply to whichever vehicle is currently active. Use the picker in the sidebar to switch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Current Odometer Reading</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.1" {...register('current_odometer')} />
                  <span className="text-sm text-muted-foreground shrink-0">{distanceUnit}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  For <span className="text-foreground">{currentVehicle?.nickname ?? '—'}</span>. Switching vehicles updates this field.
                </p>
                {errors.current_odometer && (
                  <p className="text-xs text-destructive">{errors.current_odometer.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Distance Unit</Label>
                <Select value={distanceUnit} onValueChange={v => setValue('distance_unit', v as 'km' | 'miles')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="km">Kilometres (km)</SelectItem>
                    <SelectItem value="miles">Miles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>
              System-level reminders for upcoming services, insurance renewals, and document expiries — even when the app is closed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {notificationsEnabled ? <BellRing className="h-5 w-5 text-emerald-400" /> : <Bell className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">Enable native notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Tiered alerts at 60/30/7 days for date-based items, 1000/500/0 km for service intervals.
                  </p>
                </div>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={v => setValue('notifications_enabled', v)}
              />
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={testNotification}>
                Send Test Notification
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={runCheck}>
                Run Check Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Currency */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Currency</CardTitle>
            <CardDescription>Currency used for all costs and reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-w-xs">
              <Label>Currency Code</Label>
              <Input
                placeholder="e.g. BBD, USD, EUR"
                {...register('currency')}
                className="uppercase"
                onInput={e => {
                  const el = e.target as HTMLInputElement
                  el.value = el.value.toUpperCase()
                }}
              />
              <p className="text-xs text-muted-foreground">
                Use ISO 4217 currency codes (e.g. BBD, USD, TTD, JMD)
              </p>
              {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Theme preference</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-amber-400" />}
                <div>
                  <p className="text-sm font-medium">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
                  <p className="text-xs text-muted-foreground">Current theme</p>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={checked => {
                  setValue('theme', checked ? 'dark' : 'light')
                  document.documentElement.classList.toggle('dark', checked)
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Info (read-only summary of current vehicle) */}
        {currentVehicle && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Vehicle Details</CardTitle>
              <CardDescription>To edit, manage vehicles in “My Vehicles”.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nickname</span>
                  <span className="font-medium">{currentVehicle.nickname}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Make / Model</span>
                  <span className="font-medium">{currentVehicle.year} {currentVehicle.make} {currentVehicle.model}{currentVehicle.trim ? ` ${currentVehicle.trim}` : ''}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Drivetrain</span>
                  <span className="font-medium">{DRIVETRAIN_LABELS[currentVehicle.drivetrain]}</span>
                </div>
                {currentVehicle.license_plate && <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">License Plate</span>
                    <span className="font-medium">{currentVehicle.license_plate}</span>
                  </div>
                </>}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            <Save className="h-4 w-4 mr-2" /> Save Settings
          </Button>
        </div>
      </form>
    </div>
  )
}
