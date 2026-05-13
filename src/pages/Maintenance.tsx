import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Wrench, Search, Filter } from 'lucide-react'
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
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PhotoUpload from '@/components/shared/PhotoUpload'
import EmptyState from '@/components/shared/EmptyState'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils'
import { MAINTENANCE_CATEGORIES } from '@/types'
import type { MaintenanceEntry } from '@/types'

const schema = z.object({
  date: z.string().min(1),
  odometer: z.coerce.number().positive(),
  category: z.string().min(1),
  description: z.string().min(1, 'Description is required'),
  cost: z.coerce.number().min(0),
  shop_name: z.string().optional(),
  parts_replaced: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const CATEGORY_COLORS: Record<string, string> = {
  'Oil Change': 'text-amber-400 bg-amber-500/10',
  'Brake Service': 'text-red-400 bg-red-500/10',
  'Tyre Rotation': 'text-blue-400 bg-blue-500/10',
  'Battery': 'text-yellow-400 bg-yellow-500/10',
  'Electrical': 'text-purple-400 bg-purple-500/10',
  'default': 'text-muted-foreground bg-muted',
}

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['default']
}

export default function Maintenance() {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([])
  const [filtered, setFiltered] = useState<MaintenanceEntry[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MaintenanceEntry | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const { settings } = useSettings()
  const currency = settings.currency
  const unit = settings.distance_unit

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: todayISO(), category: 'Oil Change' },
  })

  async function load() {
    const data = await window.api.maintenance.getAll()
    setEntries(data)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let result = entries
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.shop_name ?? '').toLowerCase().includes(q)
      )
    }
    if (categoryFilter !== 'all') {
      result = result.filter(e => e.category === categoryFilter)
    }
    setFiltered(result)
  }, [entries, search, categoryFilter])

  function openAdd() {
    setEditing(null)
    setPhotos([])
    reset({ date: todayISO(), category: 'Oil Change' })
    setOpen(true)
  }

  function openEdit(entry: MaintenanceEntry) {
    setEditing(entry)
    setPhotos(entry.photos ?? [])
    reset({
      date: entry.date,
      odometer: entry.odometer,
      category: entry.category,
      description: entry.description,
      cost: entry.cost,
      shop_name: entry.shop_name ?? '',
      parts_replaced: entry.parts_replaced ?? '',
      notes: entry.notes ?? '',
    })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      photos,
      shop_name: data.shop_name || null,
      parts_replaced: data.parts_replaced || null,
      notes: data.notes || null,
    }
    if (editing) {
      await window.api.maintenance.update(editing.id, payload)
      toast.success('Entry updated')
    } else {
      await window.api.maintenance.add(payload)
      toast.success('Entry added')
    }
    setOpen(false)
    load()
  }

  async function handleDelete() {
    if (deleteId === null) return
    await window.api.maintenance.delete(deleteId)
    toast.success('Entry deleted')
    setDeleteId(null)
    load()
  }

  const totalCost = filtered.reduce((s, e) => s + e.cost, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance & Repairs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} entries · Total {formatCurrency(totalCost, currency)}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Entry
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search description, shop..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {MAINTENANCE_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance entries"
          description="Log your services and repairs to track costs."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Entry</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <Card key={entry.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={getCategoryColor(entry.category)}>
                        {entry.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.odometer.toLocaleString()} {unit}
                      </span>
                    </div>
                    <p className="font-medium text-foreground">{entry.description}</p>
                    {entry.shop_name && (
                      <p className="text-sm text-muted-foreground mt-0.5">{entry.shop_name}</p>
                    )}
                    {entry.parts_replaced && (
                      <p className="text-xs text-muted-foreground mt-0.5">Parts: {entry.parts_replaced}</p>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.notes}</p>
                    )}
                    {entry.photos?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📎 {entry.photos.length} photo{entry.photos.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-bold">{formatCurrency(entry.cost, currency)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(entry.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Entry' : 'Add Maintenance Entry'}</DialogTitle>
            <DialogDescription>Record a maintenance or repair entry for this vehicle.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" {...register('date')} />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Odometer ({unit}) *</Label>
                <Input type="number" step="0.1" {...register('odometer')} />
                {errors.odometer && <p className="text-xs text-destructive">{errors.odometer.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={watch('category')} onValueChange={v => setValue('category', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cost ({currency}) *</Label>
                <Input type="number" step="0.01" {...register('cost')} />
                {errors.cost && <p className="text-xs text-destructive">{errors.cost.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input placeholder="e.g. Oil change with filter" {...register('description')} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Shop / Mechanic</Label>
              <Input placeholder="e.g. CMC Motors" {...register('shop_name')} />
            </div>
            <div className="space-y-1.5">
              <Label>Parts Replaced</Label>
              <Input placeholder="e.g. Oil filter, air filter" {...register('parts_replaced')} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} {...register('notes')} />
            </div>
            <PhotoUpload
              value={photos}
              onChange={setPhotos}
              category="maintenance"
              multiple
              label="Receipt / Invoice Photos"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Add Entry'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={v => !v && setDeleteId(null)}
        title="Delete entry?"
        description="This will permanently delete this maintenance record."
        onConfirm={handleDelete}
      />
    </div>
  )
}
