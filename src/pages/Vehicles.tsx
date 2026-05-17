import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Car, Archive, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EmptyState from '@/components/shared/EmptyState'
import { useVehicles } from '@/hooks/useVehicles'
import { DRIVETRAINS, DRIVETRAIN_LABELS } from '@/types'
import type { Vehicle, Drivetrain } from '@/types'

const schema = z.object({
  nickname: z.string().min(1, 'Give this vehicle a short name (e.g., "Daily Driver", "Wife\'s Car")'),
  make: z.string().min(1, 'Make required'),
  model: z.string().min(1, 'Model required'),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  trim: z.string().optional(),
  drivetrain: z.enum(DRIVETRAINS as unknown as [Drivetrain, ...Drivetrain[]]),
  vin: z.string().optional(),
  license_plate: z.string().optional(),
  color: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_odometer: z.coerce.number().min(0).optional(),
  current_odometer: z.coerce.number().min(0),
})
type FormData = z.infer<typeof schema>

export default function Vehicles() {
  const { vehicles, currentVehicleId, switchVehicle, refreshVehicles } = useVehicles()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      drivetrain: 'petrol-na',
      year: new Date().getFullYear(),
      current_odometer: 0,
    },
  })

  function openAdd() {
    setEditing(null)
    reset({
      nickname: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      trim: '',
      drivetrain: 'petrol-na',
      vin: '',
      license_plate: '',
      color: '',
      purchase_date: '',
      purchase_odometer: undefined,
      current_odometer: 0,
    })
    setOpen(true)
  }

  function openEdit(vehicle: Vehicle) {
    setEditing(vehicle)
    reset({
      nickname: vehicle.nickname,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      trim: vehicle.trim ?? '',
      drivetrain: vehicle.drivetrain,
      vin: vehicle.vin ?? '',
      license_plate: vehicle.license_plate ?? '',
      color: vehicle.color ?? '',
      purchase_date: vehicle.purchase_date ?? '',
      purchase_odometer: vehicle.purchase_odometer ?? undefined,
      current_odometer: vehicle.current_odometer,
    })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      trim: data.trim || null,
      vin: data.vin || null,
      license_plate: data.license_plate || null,
      color: data.color || null,
      photo: null,
      purchase_date: data.purchase_date || null,
      purchase_odometer: data.purchase_odometer ?? null,
    }
    if (editing) {
      await window.api.vehicles.update(editing.id, payload)
      toast.success(`${data.nickname} updated`)
    } else {
      const created = await window.api.vehicles.add({ ...payload, is_archived: false })
      toast.success(`${data.nickname} added — service schedule seeded for ${DRIVETRAIN_LABELS[data.drivetrain]}`)
      // Auto-switch to the new vehicle.
      await switchVehicle(created.id)
    }
    setOpen(false)
    await refreshVehicles()
  }

  async function handleDelete() {
    if (deleteId === null) return
    try {
      await window.api.vehicles.delete(deleteId)
      toast.success('Vehicle removed')
      setDeleteId(null)
      await refreshVehicles()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function toggleArchive(vehicle: Vehicle) {
    await window.api.vehicles.update(vehicle.id, { is_archived: !vehicle.is_archived })
    toast.success(vehicle.is_archived ? 'Vehicle restored' : 'Vehicle archived')
    await refreshVehicles()
  }

  const drivetrain = watch('drivetrain')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Vehicles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vehicles.filter(v => !v.is_archived).length} active · {vehicles.filter(v => v.is_archived).length} archived
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Vehicle
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles yet"
          description="Add a vehicle to start tracking its services, fuel, insurance, and documents."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Vehicle</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map(v => (
            <Card
              key={v.id}
              className={v.id === currentVehicleId ? 'border-primary/50 ring-1 ring-primary/40' : v.is_archived ? 'opacity-60' : ''}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold">{v.nickname}</h3>
                      {v.id === currentVehicleId && <Badge variant="success">Active</Badge>}
                      {v.is_archived && <Badge variant="secondary">Archived</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {DRIVETRAIN_LABELS[v.drivetrain]} · {v.current_odometer.toLocaleString()} km
                      {v.license_plate && ` · ${v.license_plate}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {v.id !== currentVehicleId && !v.is_archived && (
                    <Button size="sm" variant="outline" onClick={() => switchVehicle(v.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Switch to this
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleArchive(v)}>
                    <Archive className="h-3.5 w-3.5 mr-1.5" />
                    {v.is_archived ? 'Unarchive' : 'Archive'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(v.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.nickname}` : 'Add Vehicle'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the details for this vehicle.'
                : 'Adding a vehicle automatically seeds a service schedule appropriate for its drivetrain.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nickname *</Label>
              <Input placeholder='e.g., "Daily Driver", "Wife&apos;s Honda"' {...register('nickname')} />
              {errors.nickname && <p className="text-xs text-destructive">{errors.nickname.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Year *</Label>
                <Input type="number" {...register('year')} />
                {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Make *</Label>
                <Input placeholder="Toyota" {...register('make')} />
                {errors.make && <p className="text-xs text-destructive">{errors.make.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Model *</Label>
                <Input placeholder="Corolla" {...register('model')} />
                {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Trim</Label>
                <Input placeholder="LE / Sport / V-Cross" {...register('trim')} />
              </div>
              <div className="space-y-1.5">
                <Label>Drivetrain *</Label>
                <Select value={drivetrain} onValueChange={v => setValue('drivetrain', v as Drivetrain)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DRIVETRAINS.map(d => (
                      <SelectItem key={d} value={d}>{DRIVETRAIN_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>License Plate</Label>
                <Input placeholder="ABC-1234" {...register('license_plate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Input placeholder="Silver" {...register('color')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>VIN <span className="text-xs text-muted-foreground">(for recall lookups)</span></Label>
              <Input placeholder="17-character VIN" maxLength={17} {...register('vin')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" {...register('purchase_date')} />
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Odometer (km)</Label>
                <Input type="number" step="0.1" {...register('purchase_odometer')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Current Odometer (km) *</Label>
              <Input type="number" step="0.1" {...register('current_odometer')} />
              {errors.current_odometer && <p className="text-xs text-destructive">{errors.current_odometer.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Add Vehicle'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={v => !v && setDeleteId(null)}
        title="Delete this vehicle?"
        description="All fuel, maintenance, service, insurance, tire, and document records for this vehicle will be permanently deleted. This cannot be undone — consider archiving instead."
        onConfirm={handleDelete}
      />
    </div>
  )
}

