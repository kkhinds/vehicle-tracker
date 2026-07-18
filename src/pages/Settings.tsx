import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Save, Sun, Moon, Bell, BellRing, Database, Download, Upload,
  FolderOpen, Trash2, Clock, RefreshCw,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { formatSize } from '@/lib/utils'
import { DRIVETRAIN_LABELS } from '@/types'
import type { BackupStatus, BackupFrequency, UpdaterStatus } from '@/env'
import { format } from 'date-fns'

const schema = z.object({
  current_odometer: z.coerce.number().min(0),
  distance_unit: z.enum(['km', 'miles']),
  economy_unit: z.enum(['distance', 'l_per_100km', 'mpg']),
  currency: z.string().min(1),
  theme: z.enum(['dark', 'light']),
  notifications_enabled: z.boolean(),
})
type FormData = z.infer<typeof schema>

function updateStatusLabel(status: UpdaterStatus | null): string {
  if (!status) return ''
  switch (status.phase) {
    case 'idle': return 'Up to date'
    case 'checking': return 'Checking for updates…'
    case 'available': return `Update v${status.version} found — downloading…`
    case 'not-available': return status.error ?? 'Up to date'
    case 'downloading': return `Downloading v${status.version ?? ''} — ${Math.round(status.percent ?? 0)}%`
    case 'downloaded': return `Update v${status.version} ready to install`
    case 'error': return status.error ?? 'Update check failed'
  }
}

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

  // ─── Backup state ────────────────────────────────────────────────────────
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null)
  const [pendingRestorePath, setPendingRestorePath] = useState<string | null>(null)
  const [deleteBackupPath, setDeleteBackupPath] = useState<string | null>(null)

  async function refreshBackupStatus() {
    setBackupStatus(await window.api.backup.getStatus())
  }
  useEffect(() => { refreshBackupStatus() }, [])

  // ─── Updater state ───────────────────────────────────────────────────────
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)

  useEffect(() => {
    window.api.updater.getStatus().then(setUpdaterStatus)
    return window.api.updater.onStatus(setUpdaterStatus)
  }, [])

  async function checkForUpdates() {
    setUpdaterStatus(await window.api.updater.check())
  }

  const theme = watch('theme')
  const distanceUnit = watch('distance_unit')
  const economyUnit = watch('economy_unit')
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

  // ─── Backup handlers ─────────────────────────────────────────────────────
  async function backupNow() {
    try {
      const b = await window.api.backup.createNow()
      toast.success(`Backup created: ${b.name}`)
      refreshBackupStatus()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function exportBackup() {
    try {
      const dest = await window.api.backup.export()
      if (dest) toast.success(`Exported to ${dest}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function chooseRestoreFile() {
    const file = await window.api.backup.pickRestoreFile()
    if (file) setPendingRestorePath(file)
  }

  async function confirmRestore() {
    if (!pendingRestorePath) return
    toast.info('Restoring backup — app will restart...')
    // The handler relaunches the app; this promise won't resolve.
    void window.api.backup.restore(pendingRestorePath)
  }

  async function deleteOneBackup() {
    if (!deleteBackupPath) return
    try {
      const status = await window.api.backup.delete(deleteBackupPath)
      setBackupStatus(status)
      toast.success('Backup deleted')
      setDeleteBackupPath(null)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function setFrequency(frequency: BackupFrequency) {
    const status = await window.api.backup.updateSettings({ frequency })
    setBackupStatus(status)
  }

  async function setEnabled(enabled: boolean) {
    const status = await window.api.backup.updateSettings({ enabled })
    setBackupStatus(status)
  }

  async function setRetention(value: number) {
    const status = await window.api.backup.updateSettings({ retention: value })
    setBackupStatus(status)
  }

  async function chooseBackupDir() {
    try {
      const result = await window.api.backup.chooseDir()
      if (!result) return
      toast.success(
        result.moved > 0
          ? `Backups will now be saved to ${result.dir} (moved ${result.moved} existing file${result.moved === 1 ? '' : 's'})`
          : `Backups will now be saved to ${result.dir}`
      )
      refreshBackupStatus()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function resetBackupDir() {
    const status = await window.api.backup.resetDir()
    setBackupStatus(status)
    toast.success('Backup location reset to default')
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
              <div className="space-y-1.5">
                <Label>Fuel Economy</Label>
                <Select value={economyUnit} onValueChange={v => setValue('economy_unit', v as 'distance' | 'l_per_100km' | 'mpg')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">{distanceUnit === 'miles' ? 'Miles per litre' : 'Km per litre'}</SelectItem>
                    <SelectItem value="l_per_100km">Litres per 100 km</SelectItem>
                    <SelectItem value="mpg">MPG (US gallon)</SelectItem>
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

      {/* Software update */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Software Update
          </CardTitle>
          <CardDescription>
            Vehicle Tracker checks for updates on launch and downloads them in the
            background — you'll be asked to restart when one's ready to install.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                Version {updaterStatus?.currentVersion ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {updateStatusLabel(updaterStatus)}
              </p>
            </div>
            {updaterStatus?.phase === 'downloaded' ? (
              <Button type="button" size="sm" onClick={() => window.api.updater.install()}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Restart & install
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={checkForUpdates}
                disabled={updaterStatus?.phase === 'checking' || updaterStatus?.phase === 'downloading'}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check for updates
              </Button>
            )}
          </div>
          {updaterStatus?.phase === 'downloading' && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round(updaterStatus.percent ?? 0)}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backups & Data — outside the main settings form so its buttons
          don't double-submit the form. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Backups & Data
          </CardTitle>
          <CardDescription>
            Your data lives in a single local file. Automatic backups protect against
            corruption, drive failure, and mistakes. You can also export to a USB drive
            or restore an old snapshot at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Last backup</p>
                <p className="text-xs text-muted-foreground">
                  {backupStatus?.lastBackupAt
                    ? format(new Date(backupStatus.lastBackupAt), 'PPpp')
                    : 'No backups yet'}
                </p>
              </div>
            </div>
            <Switch
              checked={backupStatus?.enabled ?? true}
              onCheckedChange={setEnabled}
              aria-label="Enable automatic backups"
            />
          </div>

          <Separator />

          {/* Frequency + retention */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={backupStatus?.frequency ?? 'daily'}
                onValueChange={v => setFrequency(v as BackupFrequency)}
                disabled={!backupStatus?.enabled}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_open">Every app launch</SelectItem>
                  <SelectItem value="daily">Daily (recommended)</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Keep last</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={backupStatus?.retention ?? 10}
                onChange={e => setRetention(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={!backupStatus?.enabled}
              />
            </div>
          </div>

          <Separator />

          {/* Backup location */}
          <div className="space-y-1.5">
            <Label>Backup location</Label>
            <div className="flex items-center gap-2">
              <p className="flex-1 min-w-0 text-xs font-mono text-muted-foreground truncate rounded-md border bg-muted/30 px-3 py-2">
                {backupStatus?.backupsDir}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={chooseBackupDir}>
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Change…
              </Button>
              {backupStatus && !backupStatus.backupsDirIsDefault && (
                <Button type="button" variant="ghost" size="sm" onClick={resetBackupDir}>
                  Use default
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={backupNow}>
              <Database className="h-3.5 w-3.5 mr-1.5" /> Back up now
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportBackup}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export…
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={chooseRestoreFile}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Restore from file…
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.api.backup.openFolder()}
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Open folder
            </Button>
          </div>

          {/* List of recent backups */}
          {backupStatus && backupStatus.backups.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Recent backups ({backupStatus.backups.length})
                </p>
                <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
                  {backupStatus.backups.map(b => (
                    <div
                      key={b.path}
                      className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(b.createdAt), 'PPpp')} · {formatSize(b.size)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 hidden sm:inline-flex">
                        {b.name.includes('pre-restore') ? 'pre-restore' : 'auto'}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => setDeleteBackupPath(b.path)}
                        aria-label="Delete this backup"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingRestorePath !== null}
        onOpenChange={v => !v && setPendingRestorePath(null)}
        title="Restore this backup?"
        description={`The app will restart and replace your current data with the contents of "${pendingRestorePath?.split(/[\\/]/).pop()}". A safety snapshot of your current data is saved automatically first.`}
        confirmLabel="Restart & restore"
        variant="default"
        onConfirm={confirmRestore}
      />

      <ConfirmDialog
        open={deleteBackupPath !== null}
        onOpenChange={v => !v && setDeleteBackupPath(null)}
        title="Delete this backup?"
        description="The backup file will be permanently removed from disk."
        onConfirm={deleteOneBackup}
      />
    </div>
  )
}
