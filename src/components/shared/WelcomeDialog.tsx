import { useState } from 'react'
import { Database, Shield, Bell, FolderOpen } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import AppLogo from '@/components/shared/AppLogo'

interface WelcomeDialogProps {
  open: boolean
  onDismiss: () => Promise<void> | void
}

/**
 * First-launch welcome. Explains where data lives, that backups run
 * automatically, and how to recover. Shown once, then `has_seen_welcome`
 * is set to true and we never bother the user again.
 */
export default function WelcomeDialog({ open, onDismiss }: WelcomeDialogProps) {
  const [dismissing, setDismissing] = useState(false)

  async function handleDismiss() {
    setDismissing(true)
    try {
      await onDismiss()
    } finally {
      setDismissing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AppLogo size={48} />
            <div>
              <DialogTitle>Welcome to Vehicle Tracker</DialogTitle>
              <DialogDescription className="mt-0.5">
                by Kemar Hinds
              </DialogDescription>
            </div>
          </div>
          <DialogDescription className="pt-3">
            A few things to know before you start logging your vehicles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-blue-400">
              <Shield className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">Your data stays on this PC</p>
              <p className="text-xs text-muted-foreground">
                Nothing is uploaded or synced to the cloud. Everything you log lives in a single
                local database file.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
              <Database className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">Automatic backups are on</p>
              <p className="text-xs text-muted-foreground">
                A snapshot is taken daily, and the last 10 are kept. You can change frequency,
                back up manually, export to a USB drive, or restore an older snapshot any time
                from <strong>Settings → Backups & Data</strong>.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">Reminders work even when closed</p>
              <p className="text-xs text-muted-foreground">
                System notifications fire before insurance renewals, service intervals, and
                document expiries. Open Settings to test or disable.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-purple-500/15 text-purple-400">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">Add your other vehicles</p>
              <p className="text-xs text-muted-foreground">
                Click the vehicle name in the sidebar to switch between cars, or open
                <strong> My Vehicles</strong> to add a second one — each gets its own service
                schedule tuned to its drivetrain.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleDismiss} disabled={dismissing} className="w-full">
            {dismissing ? 'Getting things ready…' : 'Got it — let me in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
