import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Fuel } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PhotoUpload from '@/components/shared/PhotoUpload'
import EmptyState from '@/components/shared/EmptyState'
import DatePicker from '@/components/shared/DatePicker'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { formatCurrency, formatDate, todayISO, formatEconomy, economyValue, economyLabel } from '@/lib/utils'
import type { FuelEntry } from '@/types'
import { format, parseISO } from 'date-fns'

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  odometer: z.coerce.number().positive('Must be positive'),
  litres: z.coerce.number().positive('Must be positive'),
  cost_per_litre: z.coerce.number().positive('Must be positive'),
  total_cost: z.coerce.number().positive('Must be positive'),
  fuel_station: z.string().optional(),
  full_tank: z.boolean(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function FuelLog() {
  const [entries, setEntries] = useState<FuelEntry[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FuelEntry | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const { settings } = useSettings()
  const { currentVehicleId } = useVehicles()
  const currency = settings.currency
  const unit = settings.distance_unit
  const eu = settings.economy_unit
  const elabel = economyLabel(unit, eu)

  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: todayISO(), full_tank: true },
  })

  // Track which of the two price fields the user last edited so we can derive
  // the other one. Most people in BB look at the pump's "TOTAL" rather than
  // the per-litre price, so default to deriving cost_per_litre from total.
  const [lastEditedPrice, setLastEditedPrice] = useState<'per_litre' | 'total'>('total')
  const litres = watch('litres')
  const costPerLitre = watch('cost_per_litre')
  const totalCost = watch('total_cost')

  useEffect(() => {
    const l = Number(litres)
    if (!l || l <= 0) return
    if (lastEditedPrice === 'per_litre') {
      const cpl = Number(costPerLitre)
      if (!cpl || cpl <= 0) return
      setValue('total_cost', Math.round(l * cpl * 100) / 100, { shouldValidate: false })
    } else {
      const tc = Number(totalCost)
      if (!tc || tc <= 0) return
      setValue('cost_per_litre', Math.round((tc / l) * 1000) / 1000, { shouldValidate: false })
    }
  }, [litres, costPerLitre, totalCost, lastEditedPrice, setValue])

  async function load() {
    const data = await window.api.fuel.getAll()
    setEntries(data)
  }

  useEffect(() => { load() }, [currentVehicleId])

  function openAdd() {
    setEditing(null)
    setPhotos([])
    reset({ date: todayISO(), full_tank: true })
    setOpen(true)
  }

  function openEdit(entry: FuelEntry) {
    setEditing(entry)
    setPhotos(entry.receipt_photo ? [entry.receipt_photo] : [])
    reset({
      date: entry.date,
      odometer: entry.odometer,
      litres: entry.litres,
      cost_per_litre: entry.cost_per_litre,
      total_cost: entry.total_cost,
      fuel_station: entry.fuel_station ?? '',
      full_tank: entry.full_tank,
      notes: entry.notes ?? '',
    })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      receipt_photo: photos[0] ?? null,
      fuel_station: data.fuel_station || null,
      notes: data.notes || null,
      consumption: null,
    }
    if (editing) {
      await window.api.fuel.update(editing.id, payload)
      toast.success('Fill-up updated')
    } else {
      await window.api.fuel.add(payload)
      toast.success('Fill-up added')
    }
    setOpen(false)
    load()
  }

  async function handleDelete() {
    if (deleteId === null) return
    await window.api.fuel.delete(deleteId)
    toast.success('Entry deleted')
    setDeleteId(null)
    load()
  }

  // Chart data
  const chartEntries = [...entries].reverse()
  const efficiencyData = chartEntries
    .filter(e => e.consumption !== null)
    .map(e => ({ label: formatDate(e.date), consumption: economyValue(e.consumption, unit, eu) }))

  const monthlyMap: Record<string, number> = {}
  for (const e of entries) {
    // parseISO parses the stored 'yyyy-MM-dd' as local midnight; new Date()
    // would treat it as UTC and bucket into the wrong month in UTC- zones.
    const month = format(parseISO(e.date), 'MMM yy')
    monthlyMap[month] = (monthlyMap[month] ?? 0) + e.total_cost
  }
  // entries are newest-first, so reverse to oldest-first then take the LAST 12
  // (the most recent months), not the first 12 (the oldest).
  const monthlyData = Object.entries(monthlyMap).map(([month, cost]) => ({ month, cost })).reverse().slice(-12)

  const totalSpent = entries.reduce((s, e) => s + e.total_cost, 0)
  const avgConsumption = entries.filter(e => e.consumption).reduce((s, e, _, a) => s + (e.consumption ?? 0) / a.length, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fuel Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {entries.length} entries · Total {formatCurrency(totalSpent, currency)}
            {avgConsumption > 0 && ` · Avg ${formatEconomy(avgConsumption, unit, eu)} ${elabel}`}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Fill-up
        </Button>
      </div>

      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          {entries.length === 0 ? (
            <EmptyState
              icon={Fuel}
              title="No fuel entries yet"
              description="Start logging your fill-ups to track consumption and costs."
              action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add First Fill-up</Button>}
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Litres</TableHead>
                    <TableHead>Cost/L</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>{elabel}</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>{entry.odometer.toLocaleString()} {unit}</TableCell>
                      <TableCell>{entry.litres.toFixed(2)} L</TableCell>
                      <TableCell>{formatCurrency(entry.cost_per_litre, currency)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(entry.total_cost, currency)}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.fuel_station ?? '—'}</TableCell>
                      <TableCell>
                        {formatEconomy(entry.consumption, unit, eu)
                          ? <span className="text-green-400">{formatEconomy(entry.consumption, unit, eu)}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(entry.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Fuel Efficiency Over Time ({elabel})</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={efficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="consumption" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name={elabel} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Fuel Cost</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v, currency), 'Cost']}
                  />
                  <Bar dataKey="cost" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Cost" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Fill-up' : 'Add Fill-up'}</DialogTitle>
            <DialogDescription>Log a fuel fill-up to track consumption and costs.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} allowClear={false} />
                  )}
                />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Odometer ({unit}) *</Label>
                <Input type="number" step="0.1" {...register('odometer')} />
                {errors.odometer && <p className="text-xs text-destructive">{errors.odometer.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Litres *</Label>
                <Input type="number" step="0.01" {...register('litres')} />
                {errors.litres && <p className="text-xs text-destructive">{errors.litres.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>
                  Cost/Litre *
                  {lastEditedPrice === 'total' && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">auto</span>}
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  {...register('cost_per_litre', {
                    onChange: () => setLastEditedPrice('per_litre'),
                  })}
                />
                {errors.cost_per_litre && <p className="text-xs text-destructive">{errors.cost_per_litre.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>
                  Total Cost *
                  {lastEditedPrice === 'per_litre' && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">auto</span>}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('total_cost', {
                    onChange: () => setLastEditedPrice('total'),
                  })}
                />
                {errors.total_cost && <p className="text-xs text-destructive">{errors.total_cost.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fuel Station</Label>
              <Input placeholder="e.g. Shell Warrens" {...register('fuel_station')} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="full_tank"
                checked={watch('full_tank')}
                onCheckedChange={v => setValue('full_tank', !!v)}
              />
              <Label htmlFor="full_tank">Full tank fill-up (used for consumption calculation)</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Any notes..." rows={2} {...register('notes')} />
            </div>
            <PhotoUpload
              value={photos}
              onChange={setPhotos}
              category="fuel"
              label="Receipt Photo"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Add Fill-up'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={v => !v && setDeleteId(null)}
        title="Delete entry?"
        description="This will permanently delete this fuel entry."
        onConfirm={handleDelete}
      />
    </div>
  )
}
