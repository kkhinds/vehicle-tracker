import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, CheckCircle, Calendar, AlertTriangle, Trash2, Pencil, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { formatDate, todayISO } from '@/lib/utils'
import type { ServiceInterval } from '@/types'

const intervalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  interval_km: z.coerce.number().positive('Must be positive'),
  last_done_km: z.coerce.number().min(0).optional(),
  last_done_date: z.string().optional(),
  notes: z.string().optional(),
})

const completeSchema = z.object({
  odometer: z.coerce.number().positive('Odometer is required'),
  date: z.string().min(1, 'Date is required'),
})

type IntervalForm = z.infer<typeof intervalSchema>
type CompleteForm = z.infer<typeof completeSchema>

export default function ServiceSchedule() {
  const [intervals, setIntervals] = useState<ServiceInterval[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceInterval | null>(null)
  const [completeTarget, setCompleteTarget] = useState<ServiceInterval | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const { settings } = useSettings()
  const { currentVehicleId } = useVehicles()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const unit = settings.distance_unit

  const {
    register: regI, handleSubmit: handleI, reset: resetI, formState: { errors: errI }
  } = useForm<IntervalForm>({ resolver: zodResolver(intervalSchema) })

  const {
    register: regC, handleSubmit: handleC, reset: resetC, formState: { errors: errC }
  } = useForm<CompleteForm>({
    resolver: zodResolver(completeSchema),
    defaultValues: { date: todayISO(), odometer: settings.current_odometer },
  })

  async function load() {
    const data = await window.api.schedule.getAll()
    setIntervals(data)
  }

  useEffect(() => { load() }, [currentVehicleId])

  function openAddCustom() {
    setEditTarget(null)
    resetI({ name: '', interval_km: undefined, last_done_km: undefined, last_done_date: '', notes: '' })
    setAddOpen(true)
  }

  function openEdit(interval: ServiceInterval) {
    setEditTarget(interval)
    resetI({
      name: interval.name,
      interval_km: interval.interval_km,
      last_done_km: interval.last_done_km ?? undefined,
      last_done_date: interval.last_done_date ?? '',
      notes: interval.notes ?? '',
    })
    setAddOpen(true)
  }

  async function onIntervalSubmit(data: IntervalForm) {
    const payload = {
      ...data,
      last_done_km: data.last_done_km ?? null,
      last_done_date: data.last_done_date || null,
      notes: data.notes || null,
      is_custom: editTarget ? editTarget.is_custom : true,
      category_key: editTarget?.category_key ?? null,
      consequence_of_skipping: editTarget?.consequence_of_skipping ?? null,
    }
    if (editTarget) {
      await window.api.schedule.update(editTarget.id, payload)
      toast.success('Interval updated')
    } else {
      await window.api.schedule.add(payload)
      toast.success('Custom interval added')
    }
    setAddOpen(false)
    load()
  }

  function openComplete(interval: ServiceInterval) {
    setCompleteTarget(interval)
    resetC({ date: todayISO(), odometer: settings.current_odometer || undefined })
  }

  async function onCompleteSubmit(data: CompleteForm) {
    if (!completeTarget) return
    await window.api.schedule.complete(completeTarget.id, data.odometer, data.date)
    toast.success(`${completeTarget.name} marked as done`)
    setCompleteTarget(null)
    load()
  }

  async function handleDelete() {
    if (deleteId === null) return
    await window.api.schedule.delete(deleteId)
    toast.success('Interval removed')
    setDeleteId(null)
    load()
  }

  const overdue = intervals.filter(i => i.status === 'overdue')
  const dueSoon = intervals.filter(i => i.status === 'due-soon')
  const ok = intervals.filter(i => i.status === 'ok')

  function getStatusBadge(status?: string) {
    if (status === 'overdue') return <Badge variant="danger">Overdue</Badge>
    if (status === 'due-soon') return <Badge variant="warning">Due Soon</Badge>
    return <Badge variant="success">OK</Badge>
  }

  function IntervalCard({ interval }: { interval: ServiceInterval }) {
    const pct = interval.last_done_km && interval.next_due_km
      ? Math.max(0, Math.min(100, ((settings.current_odometer - interval.last_done_km) / interval.interval_km) * 100))
      : 0
    const expanded = expandedId === interval.id
    const hasWhy = !!interval.consequence_of_skipping

    return (
      <Card className={interval.status === 'overdue' ? 'border-red-500/30' : interval.status === 'due-soon' ? 'border-amber-500/30' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">{interval.name}</span>
                {getStatusBadge(interval.status)}
              </div>
              <p className="text-xs text-muted-foreground">
                Every {interval.interval_km.toLocaleString()} {unit}
                {interval.last_done_km && ` · Last: ${interval.last_done_km.toLocaleString()} ${unit}`}
                {interval.last_done_date && ` (${formatDate(interval.last_done_date)})`}
              </p>
              <p className="text-sm mt-1">
                {interval.km_remaining !== undefined && (
                  interval.km_remaining <= 0
                    ? <span className="text-red-400">Overdue by {Math.abs(interval.km_remaining).toLocaleString()} {unit}</span>
                    : <span className="text-muted-foreground">Due in <span className="text-foreground font-medium">{interval.km_remaining.toLocaleString()}</span> {unit}</span>
                )}
              </p>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    interval.status === 'overdue' ? 'bg-red-500' :
                    interval.status === 'due-soon' ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>

              {hasWhy && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : interval.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Info className="h-3 w-3" />
                    Why this matters
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {expanded && (
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded p-2.5">
                      {interval.consequence_of_skipping}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400" title="Mark complete" onClick={() => openComplete(interval)}>
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(interval)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {interval.is_custom && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(interval.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Current odometer: {settings.current_odometer.toLocaleString()} {unit}
          </p>
        </div>
        <Button onClick={openAddCustom}>
          <Plus className="h-4 w-4 mr-2" /> Add Custom
        </Button>
      </div>

      {overdue.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Overdue ({overdue.length})
          </h2>
          {overdue.map(i => <IntervalCard key={i.id} interval={i} />)}
        </div>
      )}

      {dueSoon.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Due Soon ({dueSoon.length})
          </h2>
          {dueSoon.map(i => <IntervalCard key={i.id} interval={i} />)}
        </div>
      )}

      {ok.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-green-400 flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" /> All Good ({ok.length})
          </h2>
          {ok.map(i => <IntervalCard key={i.id} interval={i} />)}
        </div>
      )}

      {/* Add/Edit custom interval */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Interval' : 'Add Custom Interval'}</DialogTitle>
            <DialogDescription>Configure a custom service interval to track on your dashboard.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleI(onIntervalSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="e.g. Tyre replacement" {...regI('name')} />
              {errI.name && <p className="text-xs text-destructive">{errI.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Interval ({unit}) *</Label>
              <Input type="number" placeholder="e.g. 50000" {...regI('interval_km')} />
              {errI.interval_km && <p className="text-xs text-destructive">{errI.interval_km.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Last Done ({unit})</Label>
                <Input type="number" {...regI('last_done_km')} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Done Date</Label>
                <Input type="date" {...regI('last_done_date')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} {...regI('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit">{editTarget ? 'Save' : 'Add Interval'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complete service dialog */}
      <Dialog open={!!completeTarget} onOpenChange={v => !v && setCompleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete: {completeTarget?.name}</DialogTitle>
            <DialogDescription>Record that this service has been performed at the current odometer.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleC(onCompleteSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Odometer Reading ({unit}) *</Label>
              <Input type="number" step="0.1" {...regC('odometer')} />
              {errC.odometer && <p className="text-xs text-destructive">{errC.odometer.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" {...regC('date')} />
              {errC.date && <p className="text-xs text-destructive">{errC.date.message}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              This will also create a maintenance log entry automatically.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCompleteTarget(null)}>Cancel</Button>
              <Button type="submit">Mark as Done</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={v => !v && setDeleteId(null)}
        title="Remove interval?"
        description="This will remove the custom service interval."
        onConfirm={handleDelete}
      />
    </div>
  )
}
