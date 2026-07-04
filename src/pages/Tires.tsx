import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, CircleDot, AlertTriangle, History, Gauge, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EmptyState from '@/components/shared/EmptyState'
import DatePicker from '@/components/shared/DatePicker'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { formatDate, todayISO } from '@/lib/utils'
import { optionalNumber } from '@/lib/forms'
import type { TireSet, TireInspection, TireRotation } from '@/types'

const setSchema = z.object({
  brand: z.string().min(1, 'Brand required'),
  model: z.string().min(1, 'Model required'),
  size: z.string().min(1, 'Tire size required (e.g., 265/65R17)'),
  dot_date: z.string().optional(),
  install_date: z.string().min(1),
  install_odometer: z.coerce.number().min(0),
  recommended_psi_front: optionalNumber(z.coerce.number().min(0)),
  recommended_psi_rear: optionalNumber(z.coerce.number().min(0)),
  notes: z.string().optional(),
})
type SetForm = z.infer<typeof setSchema>

const inspectionSchema = z.object({
  date: z.string().min(1),
  odometer: z.coerce.number().min(0),
  tread_fl: optionalNumber(z.coerce.number().min(0).max(15)),
  tread_fr: optionalNumber(z.coerce.number().min(0).max(15)),
  tread_rl: optionalNumber(z.coerce.number().min(0).max(15)),
  tread_rr: optionalNumber(z.coerce.number().min(0).max(15)),
  pressure_fl: optionalNumber(z.coerce.number().min(0).max(80)),
  pressure_fr: optionalNumber(z.coerce.number().min(0).max(80)),
  pressure_rl: optionalNumber(z.coerce.number().min(0).max(80)),
  pressure_rr: optionalNumber(z.coerce.number().min(0).max(80)),
  notes: z.string().optional(),
})
type InspectionForm = z.infer<typeof inspectionSchema>

const rotationSchema = z.object({
  date: z.string().min(1),
  odometer: z.coerce.number().min(0),
  pattern: z.enum(['front-to-back', 'cross', 'x-pattern', 'side-to-side', 'other']),
  notes: z.string().optional(),
})
type RotationForm = z.infer<typeof rotationSchema>

const ROTATION_LABELS: Record<RotationForm['pattern'], string> = {
  'front-to-back': 'Front ↔ Back',
  'cross': 'Cross (X)',
  'x-pattern': 'X-Pattern (DRW)',
  'side-to-side': 'Side ↔ Side',
  'other': 'Other',
}

function minTread(insp: TireInspection): number | null {
  const treads = [insp.tread_fl, insp.tread_fr, insp.tread_rl, insp.tread_rr]
    .filter((v): v is number => v !== null && v !== undefined)
  return treads.length ? Math.min(...treads) : null
}

export default function Tires() {
  const { settings } = useSettings()
  const { currentVehicleId } = useVehicles()
  const unit = settings.distance_unit

  const [sets, setSets] = useState<TireSet[]>([])
  const [selectedSet, setSelectedSet] = useState<TireSet | null>(null)
  const [inspections, setInspections] = useState<TireInspection[]>([])
  const [rotations, setRotations] = useState<TireRotation[]>([])

  const [setOpen, setSetOpen] = useState(false)
  const [inspOpen, setInspOpen] = useState(false)
  const [rotOpen, setRotOpen] = useState(false)
  const [editingSet, setEditingSet] = useState<TireSet | null>(null)
  const [deleteSetId, setDeleteSetId] = useState<number | null>(null)
  const [retireSet, setRetireSet] = useState<TireSet | null>(null)

  const setForm = useForm<SetForm>({
    resolver: zodResolver(setSchema),
    defaultValues: { install_date: todayISO(), install_odometer: settings.current_odometer || 0 },
  })

  const inspForm = useForm<InspectionForm>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: { date: todayISO(), odometer: settings.current_odometer || 0 },
  })

  const rotForm = useForm<RotationForm>({
    resolver: zodResolver(rotationSchema),
    defaultValues: { date: todayISO(), odometer: settings.current_odometer || 0, pattern: 'front-to-back' },
  })

  async function loadSets() {
    const data = await window.api.tires.getSets()
    setSets(data)
    if (data.length > 0 && (!selectedSet || !data.find(s => s.id === selectedSet.id))) {
      setSelectedSet(data[0])
    } else if (data.length === 0) {
      setSelectedSet(null)
    }
  }

  async function loadDetails(setId: number) {
    const [insp, rot] = await Promise.all([
      window.api.tires.getInspections(setId),
      window.api.tires.getRotations(setId),
    ])
    setInspections(insp)
    setRotations(rot)
  }

  useEffect(() => { loadSets() }, [currentVehicleId])

  useEffect(() => {
    if (selectedSet) loadDetails(selectedSet.id)
    else { setInspections([]); setRotations([]) }
  }, [selectedSet?.id])

  function openAddSet() {
    setEditingSet(null)
    setForm.reset({
      brand: '', model: '', size: '', dot_date: '',
      install_date: todayISO(),
      install_odometer: settings.current_odometer || 0,
      notes: '',
    })
    setSetOpen(true)
  }

  function openEditSet(s: TireSet) {
    setEditingSet(s)
    setForm.reset({
      brand: s.brand,
      model: s.model,
      size: s.size,
      dot_date: s.dot_date ?? '',
      install_date: s.install_date,
      install_odometer: s.install_odometer,
      recommended_psi_front: s.recommended_psi_front ?? undefined,
      recommended_psi_rear: s.recommended_psi_rear ?? undefined,
      notes: s.notes ?? '',
    })
    setSetOpen(true)
  }

  async function onSetSubmit(data: SetForm) {
    const payload = {
      ...data,
      dot_date: data.dot_date || null,
      recommended_psi_front: data.recommended_psi_front ?? null,
      recommended_psi_rear: data.recommended_psi_rear ?? null,
      notes: data.notes || null,
      retired_date: null,
      retired_odometer: null,
    }
    if (editingSet) {
      await window.api.tires.updateSet(editingSet.id, payload)
      toast.success('Tire set updated')
    } else {
      await window.api.tires.addSet(payload)
      toast.success('Tire set added')
    }
    setSetOpen(false)
    loadSets()
  }

  async function onInspSubmit(data: InspectionForm) {
    if (!selectedSet) return
    await window.api.tires.addInspection({
      ...data,
      tire_set_id: selectedSet.id,
      tread_fl: data.tread_fl ?? null,
      tread_fr: data.tread_fr ?? null,
      tread_rl: data.tread_rl ?? null,
      tread_rr: data.tread_rr ?? null,
      pressure_fl: data.pressure_fl ?? null,
      pressure_fr: data.pressure_fr ?? null,
      pressure_rl: data.pressure_rl ?? null,
      pressure_rr: data.pressure_rr ?? null,
      notes: data.notes || null,
      photo: null,
    })
    toast.success('Inspection logged')
    setInspOpen(false)
    inspForm.reset({ date: todayISO(), odometer: settings.current_odometer || 0 })
    loadDetails(selectedSet.id)
  }

  async function onRotSubmit(data: RotationForm) {
    if (!selectedSet) return
    await window.api.tires.addRotation({
      ...data,
      tire_set_id: selectedSet.id,
      notes: data.notes || null,
    })
    toast.success('Rotation logged')
    setRotOpen(false)
    rotForm.reset({ date: todayISO(), odometer: settings.current_odometer || 0, pattern: 'front-to-back' })
    loadDetails(selectedSet.id)
  }

  async function handleDeleteSet() {
    if (deleteSetId === null) return
    await window.api.tires.deleteSet(deleteSetId)
    toast.success('Tire set deleted')
    setDeleteSetId(null)
    loadSets()
  }

  async function handleRetire() {
    if (!retireSet) return
    await window.api.tires.retireSet(retireSet.id, todayISO(), settings.current_odometer)
    toast.success(`${retireSet.brand} ${retireSet.model} retired`)
    setRetireSet(null)
    loadSets()
  }

  const latestInspection = inspections[0]
  const minTreadValue = latestInspection ? minTread(latestInspection) : null
  const warn = selectedSet && selectedSet.is_active && (
    (selectedSet.age_years !== undefined && selectedSet.age_years > 6) ||
    (minTreadValue !== null && minTreadValue <= 2)
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tires</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track tread depth, pressure, rotations — and get warned before they're unsafe.
          </p>
        </div>
        <Button onClick={openAddSet}>
          <Plus className="h-4 w-4 mr-2" /> Add Tire Set
        </Button>
      </div>

      {sets.length === 0 ? (
        <EmptyState
          icon={CircleDot}
          title="No tire sets logged"
          description="Add your current tire set to start tracking inspections, rotations, and replacement timing."
          action={<Button onClick={openAddSet}><Plus className="h-4 w-4 mr-2" />Add Tire Set</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tire set list */}
          <div className="space-y-3 lg:col-span-1">
            {sets.map(s => (
              <Card
                key={s.id}
                className={`cursor-pointer ${s.id === selectedSet?.id ? 'border-primary/50 ring-1 ring-primary/40' : ''} ${s.retired_date ? 'opacity-60' : ''}`}
                onClick={() => setSelectedSet(s)}
              >
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{s.brand} {s.model}</span>
                    {s.retired_date ? <Badge variant="secondary">Retired</Badge> : <Badge variant="success">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.size}</p>
                  <p className="text-xs text-muted-foreground">
                    Installed {formatDate(s.install_date)} · {s.install_odometer.toLocaleString()} {unit}
                  </p>
                  {s.age_years !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Age: {s.age_years} years{s.age_years > 6 && ' ⚠'}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Selected set detail */}
          <div className="lg:col-span-2 space-y-4">
            {selectedSet && (
              <>
                {warn && (
                  <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Replacement recommended</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedSet.age_years !== undefined && selectedSet.age_years > 6 &&
                            `Tires are ${selectedSet.age_years} years old. `}
                          {minTreadValue !== null && minTreadValue <= 2 &&
                            `Tread is ${minTreadValue.toFixed(1)} mm — legal limit 1.6 mm, replace at 2 mm.`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{selectedSet.brand} {selectedSet.model}</h3>
                        <p className="text-sm text-muted-foreground">{selectedSet.size}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Installed: {formatDate(selectedSet.install_date)} · {selectedSet.install_odometer.toLocaleString()} {unit}
                          {selectedSet.dot_date && ` · DOT ${selectedSet.dot_date}`}
                        </p>
                        {selectedSet.retired_date && (
                          <p className="text-xs text-muted-foreground">
                            Retired: {formatDate(selectedSet.retired_date)}
                            {selectedSet.retired_odometer && ` at ${selectedSet.retired_odometer.toLocaleString()} ${unit}`}
                          </p>
                        )}
                        {(selectedSet.recommended_psi_front || selectedSet.recommended_psi_rear) && (
                          <p className="text-xs text-muted-foreground">
                            Recommended PSI: F {selectedSet.recommended_psi_front ?? '—'} / R {selectedSet.recommended_psi_rear ?? '—'}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditSet(selectedSet)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteSetId(selectedSet.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {!selectedSet.retired_date && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button size="sm" onClick={() => { inspForm.reset({ date: todayISO(), odometer: settings.current_odometer || 0 }); setInspOpen(true) }}>
                          <Gauge className="h-3.5 w-3.5 mr-1.5" /> Log Inspection
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { rotForm.reset({ date: todayISO(), odometer: settings.current_odometer || 0, pattern: 'front-to-back' }); setRotOpen(true) }}>
                          <RotateCw className="h-3.5 w-3.5 mr-1.5" /> Log Rotation
                        </Button>
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRetireSet(selectedSet)}>
                          Retire Set
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Tabs defaultValue="inspections">
                  <TabsList>
                    <TabsTrigger value="inspections">Inspections ({inspections.length})</TabsTrigger>
                    <TabsTrigger value="rotations">Rotations ({rotations.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="inspections" className="space-y-2 mt-4">
                    {inspections.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No inspections logged. Track tread depth every ~6 months to catch wear early.</p>
                    ) : inspections.map(i => {
                      const treads = [i.tread_fl, i.tread_fr, i.tread_rl, i.tread_rr]
                      const pressures = [i.pressure_fl, i.pressure_fr, i.pressure_rl, i.pressure_rr]
                      const m = minTread(i)
                      return (
                        <Card key={i.id}>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{formatDate(i.date)}</span>
                              <span className="text-xs text-muted-foreground">{i.odometer.toLocaleString()} {unit}</span>
                            </div>
                            {treads.some(t => t !== null) && (
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                {treads.map((t, idx) => (
                                  <div key={idx} className="bg-muted/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground">{['FL', 'FR', 'RL', 'RR'][idx]}</p>
                                    <p className={`font-medium ${t !== null && t <= 2 ? 'text-red-400' : t !== null && t <= 3 ? 'text-amber-400' : ''}`}>
                                      {t !== null ? `${t} mm` : '—'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {pressures.some(p => p !== null) && (
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                {pressures.map((p, idx) => (
                                  <div key={idx} className="bg-muted/20 rounded p-2 text-center">
                                    <p className="text-muted-foreground">{['FL', 'FR', 'RL', 'RR'][idx]} PSI</p>
                                    <p className="font-medium">{p !== null ? p : '—'}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {m !== null && (
                              <p className="text-xs text-muted-foreground">
                                Min tread: {m.toFixed(1)} mm {m <= 2 ? '⚠ replace now' : m <= 3 ? '⚠ replace soon' : ''}
                              </p>
                            )}
                            {i.notes && <p className="text-xs italic text-muted-foreground">{i.notes}</p>}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </TabsContent>
                  <TabsContent value="rotations" className="space-y-2 mt-4">
                    {rotations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No rotations logged. Rotate every ~10,000 km to even out wear.</p>
                    ) : rotations.map(r => (
                      <Card key={r.id}>
                        <CardContent className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <History className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm">{ROTATION_LABELS[r.pattern as RotationForm['pattern']]}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(r.date)} · {r.odometer.toLocaleString()} {unit}
                              </p>
                            </div>
                          </div>
                          {r.notes && <p className="text-xs italic text-muted-foreground">{r.notes}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit set */}
      <Dialog open={setOpen} onOpenChange={setSetOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSet ? 'Edit Tire Set' : 'Add Tire Set'}</DialogTitle>
            <DialogDescription>
              The DOT date is the 4-digit code on the sidewall (WWYY week/year of manufacture) — tires age out at ~6 years even with good tread.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={setForm.handleSubmit(onSetSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand *</Label>
                <Input placeholder="Michelin" {...setForm.register('brand')} />
                {setForm.formState.errors.brand && <p className="text-xs text-destructive">{setForm.formState.errors.brand.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Model *</Label>
                <Input placeholder="LTX A/T2" {...setForm.register('model')} />
                {setForm.formState.errors.model && <p className="text-xs text-destructive">{setForm.formState.errors.model.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Size *</Label>
                <Input placeholder="265/65R17" {...setForm.register('size')} />
                {setForm.formState.errors.size && <p className="text-xs text-destructive">{setForm.formState.errors.size.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>DOT Date (WWYY)</Label>
                <Input placeholder="2522" {...setForm.register('dot_date')} maxLength={4} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Install Date *</Label>
                <Controller
                name="install_date"
                control={setForm.control}
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} allowClear={false} />
                )}
              />
              </div>
              <div className="space-y-1.5">
                <Label>Install Odometer ({unit}) *</Label>
                <Input type="number" step="0.1" {...setForm.register('install_odometer')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recommended Front PSI</Label>
                <Input type="number" step="0.5" placeholder="from door placard" {...setForm.register('recommended_psi_front')} />
              </div>
              <div className="space-y-1.5">
                <Label>Recommended Rear PSI</Label>
                <Input type="number" step="0.5" {...setForm.register('recommended_psi_rear')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} {...setForm.register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSetOpen(false)}>Cancel</Button>
              <Button type="submit">{editingSet ? 'Save Changes' : 'Add Tire Set'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inspection */}
      <Dialog open={inspOpen} onOpenChange={setInspOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Inspection</DialogTitle>
            <DialogDescription>
              Measure tread depth with a coin gauge — 2 mm is replace-now territory, 1.6 mm is illegal in most jurisdictions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={inspForm.handleSubmit(onInspSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Controller
                  name="date"
                  control={inspForm.control}
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} allowClear={false} />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Odometer ({unit}) *</Label>
                <Input type="number" step="0.1" {...inspForm.register('odometer')} />
              </div>
            </div>
            <div>
              <Label>Tread Depth (mm)</Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <div><Label className="text-xs text-muted-foreground">Front Left</Label><Input type="number" step="0.1" {...inspForm.register('tread_fl')} /></div>
                <div><Label className="text-xs text-muted-foreground">Front Right</Label><Input type="number" step="0.1" {...inspForm.register('tread_fr')} /></div>
                <div><Label className="text-xs text-muted-foreground">Rear Left</Label><Input type="number" step="0.1" {...inspForm.register('tread_rl')} /></div>
                <div><Label className="text-xs text-muted-foreground">Rear Right</Label><Input type="number" step="0.1" {...inspForm.register('tread_rr')} /></div>
              </div>
            </div>
            <div>
              <Label>Pressure (PSI, cold)</Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <div><Label className="text-xs text-muted-foreground">Front Left</Label><Input type="number" step="0.5" {...inspForm.register('pressure_fl')} /></div>
                <div><Label className="text-xs text-muted-foreground">Front Right</Label><Input type="number" step="0.5" {...inspForm.register('pressure_fr')} /></div>
                <div><Label className="text-xs text-muted-foreground">Rear Left</Label><Input type="number" step="0.5" {...inspForm.register('pressure_rl')} /></div>
                <div><Label className="text-xs text-muted-foreground">Rear Right</Label><Input type="number" step="0.5" {...inspForm.register('pressure_rr')} /></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} placeholder="Uneven wear, vibrations, etc." {...inspForm.register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInspOpen(false)}>Cancel</Button>
              <Button type="submit">Log Inspection</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rotation */}
      <Dialog open={rotOpen} onOpenChange={setRotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Rotation</DialogTitle>
            <DialogDescription>Record a tire rotation to keep the wear pattern history.</DialogDescription>
          </DialogHeader>
          <form onSubmit={rotForm.handleSubmit(onRotSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Controller
                  name="date"
                  control={rotForm.control}
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} allowClear={false} />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Odometer ({unit}) *</Label>
                <Input type="number" step="0.1" {...rotForm.register('odometer')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Pattern *</Label>
              <Select value={rotForm.watch('pattern')} onValueChange={v => rotForm.setValue('pattern', v as RotationForm['pattern'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROTATION_LABELS) as RotationForm['pattern'][]).map(p => (
                    <SelectItem key={p} value={p}>{ROTATION_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} {...rotForm.register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRotOpen(false)}>Cancel</Button>
              <Button type="submit">Log Rotation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteSetId !== null}
        onOpenChange={v => !v && setDeleteSetId(null)}
        title="Delete this tire set?"
        description="All inspections and rotations for this set will also be deleted."
        onConfirm={handleDeleteSet}
      />

      <ConfirmDialog
        open={retireSet !== null}
        onOpenChange={v => !v && setRetireSet(null)}
        title={`Retire ${retireSet?.brand} ${retireSet?.model}?`}
        description={`Mark as retired today at ${settings.current_odometer.toLocaleString()} ${unit}. You can still see the history; new inspections/rotations stop.`}
        confirmLabel="Retire"
        variant="default"
        onConfirm={handleRetire}
      />
    </div>
  )
}
