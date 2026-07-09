import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Droplet, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EmptyState from '@/components/shared/EmptyState'
import DatePicker from '@/components/shared/DatePicker'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { formatDate, todayISO } from '@/lib/utils'
import type { FluidTopup, FluidStat, FluidPresetDTO } from '@/types'

const UNITS = ['ml', 'L', 'oz'] as const

const schema = z.object({
  fluid_type: z.string().min(1, 'Pick a fluid'),
  date: z.string().min(1),
  odometer: z.coerce.number().min(0),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  unit: z.enum(UNITS),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function Fluids() {
  const { settings } = useSettings()
  const { currentVehicleId } = useVehicles()
  const unit = settings.distance_unit

  const [stats, setStats] = useState<FluidStat[]>([])
  const [presets, setPresets] = useState<FluidPresetDTO[]>([])
  const [entries, setEntries] = useState<FluidTopup[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FluidTopup | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [expandedFluid, setExpandedFluid] = useState<string | null>(null)

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fluid_type: 'engine-oil',
      date: todayISO(),
      odometer: settings.current_odometer || 0,
      amount: undefined,
      unit: 'ml',
    },
  })

  async function load() {
    const [s, p, e] = await Promise.all([
      window.api.fluids.getStats(),
      window.api.fluids.getPresets(),
      window.api.fluids.getAll(),
    ])
    setStats(s)
    setPresets(p)
    setEntries(e)
  }

  useEffect(() => { load() }, [currentVehicleId])

  function openAdd(prefillFluidType?: string) {
    setEditing(null)
    const preset = presets.find(p => p.key === (prefillFluidType ?? 'engine-oil'))
    reset({
      fluid_type: prefillFluidType ?? 'engine-oil',
      date: todayISO(),
      odometer: settings.current_odometer || 0,
      amount: undefined,
      unit: preset?.unit ?? 'ml',
      notes: '',
    })
    setOpen(true)
  }

  function openEdit(t: FluidTopup) {
    setEditing(t)
    reset({
      fluid_type: t.fluid_type,
      date: t.date,
      odometer: t.odometer,
      amount: t.amount,
      unit: t.unit,
      notes: t.notes ?? '',
    })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    const payload = { ...data, notes: data.notes || null }
    if (editing) {
      await window.api.fluids.update(editing.id, payload)
      toast.success('Top-up updated')
    } else {
      await window.api.fluids.add(payload)
      toast.success('Top-up logged')
    }
    setOpen(false)
    load()
  }

  async function handleDelete() {
    if (deleteId === null) return
    await window.api.fluids.delete(deleteId)
    toast.success('Entry deleted')
    setDeleteId(null)
    load()
  }

  const fluidType = watch('fluid_type')

  // When the user changes fluid in the form, auto-pick that fluid's default unit.
  useEffect(() => {
    const preset = presets.find(p => p.key === fluidType)
    if (preset) setValue('unit', preset.unit)
  }, [fluidType, presets, setValue])

  const visibleStats = stats.filter(s => s.preset.relevant || s.entries > 0)
  const hiddenStats = stats.filter(s => !s.preset.relevant && s.entries === 0)
  const [showAll, setShowAll] = useState(false)

  function statusBadge(stat: FluidStat) {
    if (stat.exceedsThreshold) return <Badge variant="danger">High consumption</Badge>
    if (stat.entries === 0) return <Badge variant="secondary">Not logged</Badge>
    if (stat.consumptionPer1000Km !== null) return <Badge variant="success">Normal</Badge>
    return <Badge variant="outline">Logged</Badge>
  }

  function FluidCard({ stat }: { stat: FluidStat }) {
    const expanded = expandedFluid === stat.preset.key
    const fluidEntries = entries.filter(e => e.fluid_type === stat.preset.key).slice(0, 5)

    return (
      <Card className={stat.exceedsThreshold ? 'border-red-500/30' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Droplet className={`h-4 w-4 ${stat.exceedsThreshold ? 'text-red-400' : 'text-blue-400'}`} />
                <span className="font-medium">{stat.preset.label}</span>
                {statusBadge(stat)}
              </div>

              {stat.consumptionPer1000Km !== null ? (
                <p className="text-sm">
                  <span className={stat.exceedsThreshold ? 'text-red-400' : 'text-foreground'}>
                    {stat.consumptionPer1000Km} {stat.preset.unit}
                  </span>
                  <span className="text-muted-foreground"> per 1,000 km</span>
                  {stat.preset.warnPerThousandKm < 99999 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (warn above {stat.preset.warnPerThousandKm} {stat.preset.unit})
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {stat.entries === 0
                    ? 'No top-ups logged yet'
                    : 'Need more entries or distance to compute a rate'}
                </p>
              )}

              {stat.lastTopup && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last: {stat.lastTopup.amount} {stat.preset.unit} on {formatDate(stat.lastTopup.date)} at {stat.lastTopup.odometer.toLocaleString()} {unit}
                </p>
              )}
              {stat.entries > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total logged: {stat.totalAmount} {stat.preset.unit} across {stat.entries} top-up{stat.entries === 1 ? '' : 's'}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => openAdd(stat.preset.key)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Log top-up
              </Button>
            </div>
          </div>

          {/* "Why this matters" */}
          {stat.preset.meaning && (
            <>
              <button
                type="button"
                onClick={() => setExpandedFluid(expanded ? null : stat.preset.key)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
              >
                <Info className="h-3 w-3" />
                {expanded ? 'Hide details' : 'Why this matters'}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {expanded && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded p-2.5">
                  {stat.preset.meaning}
                </p>
              )}
            </>
          )}

          {/* Recent entries */}
          {expanded && fluidEntries.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent top-ups</p>
              {fluidEntries.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                  <div>
                    <span className="font-medium">{t.amount} {t.unit}</span>
                    <span className="text-muted-foreground"> · {formatDate(t.date)} · {t.odometer.toLocaleString()} {unit}</span>
                    {t.notes && <span className="text-muted-foreground italic"> · {t.notes}</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(t)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const concerning = visibleStats.filter(s => s.exceedsThreshold)
  const watched = visibleStats.filter(s => !s.exceedsThreshold)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fluids</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track top-ups between services — early warning for leaks, oil burning, and worn parts.
          </p>
        </div>
        <Button onClick={() => openAdd()}>
          <Plus className="h-4 w-4 mr-2" /> Log Top-up
        </Button>
      </div>

      {visibleStats.length === 0 ? (
        <EmptyState
          icon={Droplet}
          title="No fluids to track yet"
          description="Pick the fluids your vehicle uses and start logging top-ups between services to catch leaks and wear early."
          action={<Button onClick={() => openAdd()}><Plus className="h-4 w-4 mr-2" />Log Your First Top-up</Button>}
        />
      ) : (
        <div className="space-y-6">
          {concerning.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Needs Attention ({concerning.length})
              </h2>
              {concerning.map(s => <FluidCard key={s.preset.key} stat={s} />)}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <Droplet className="h-4 w-4" /> Fluids ({watched.length})
            </h2>
            {watched.map(s => <FluidCard key={s.preset.key} stat={s} />)}
          </div>

          {hiddenStats.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowAll(s => !s)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showAll ? 'Hide' : 'Show'} {hiddenStats.length} other fluid type{hiddenStats.length === 1 ? '' : 's'}
              </button>
              {showAll && (
                <div className="space-y-2 mt-2">
                  {hiddenStats.map(s => <FluidCard key={s.preset.key} stat={s} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Top-up' : 'Log Top-up'}</DialogTitle>
            <DialogDescription>
              How much fluid you added, when, and at what odometer reading.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Fluid *</Label>
              <Select value={fluidType} onValueChange={v => setValue('fluid_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[15rem]">
                  {presets.map(p => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}{!p.relevant && ' (uncommon for your vehicle)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fluid_type && <p className="text-xs text-destructive">{errors.fluid_type.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} allowClear={false} />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Odometer ({unit}) *</Label>
                <Input type="number" step="0.1" {...register('odometer')} />
                {errors.odometer && <p className="text-xs text-destructive">{errors.odometer.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Amount added *</Label>
                <Input type="number" step="0.01" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={watch('unit')} onValueChange={v => setValue('unit', v as 'ml' | 'L' | 'oz')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="oz">oz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} placeholder="What you observed, brand of fluid, etc." {...register('notes')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Log Top-up'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={v => !v && setDeleteId(null)}
        title="Delete this top-up?"
        description="The entry will be permanently deleted."
        onConfirm={handleDelete}
      />
    </div>
  )
}
