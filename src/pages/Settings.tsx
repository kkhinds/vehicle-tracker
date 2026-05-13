import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Sun, Moon } from 'lucide-react'
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

const schema = z.object({
  current_odometer: z.coerce.number().min(0),
  distance_unit: z.enum(['km', 'miles']),
  currency: z.string().min(1),
  theme: z.enum(['dark', 'light']),
})
type FormData = z.infer<typeof schema>

export default function Settings() {
  const { settings, refreshSettings } = useSettings()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: settings,
  })

  useEffect(() => {
    reset(settings)
  }, [settings, reset])

  const theme = watch('theme')
  const distanceUnit = watch('distance_unit')

  async function onSubmit(data: FormData) {
    await window.api.settings.update(data)
    await refreshSettings()
    document.documentElement.classList.toggle('dark', data.theme === 'dark')
    toast.success('Settings saved')
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your D-Max Tracker preferences</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Vehicle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle</CardTitle>
            <CardDescription>Current odometer and distance units</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Current Odometer Reading</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.1" {...register('current_odometer')} />
                  <span className="text-sm text-muted-foreground shrink-0">{distanceUnit}</span>
                </div>
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
                onCheckedChange={checked => setValue('theme', checked ? 'dark' : 'light')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Info (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle Information</CardTitle>
            <CardDescription>Your tracked vehicle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Make</span>
                <span className="font-medium">Isuzu</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">D-Max 3.0TD Double Cab V-Cross</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Year</span>
                <span className="font-medium">2022</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Engine</span>
                <span className="font-medium">3.0L Turbodiesel</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            <Save className="h-4 w-4 mr-2" /> Save Settings
          </Button>
        </div>
      </form>
    </div>
  )
}
