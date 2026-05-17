import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, FileBadge2, AlertTriangle } from 'lucide-react'
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
import { useVehicles } from '@/hooks/useVehicles'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/types'
import type { VehicleDocument, DocumentType } from '@/types'

const schema = z.object({
  doc_type: z.enum(DOCUMENT_TYPES as unknown as [DocumentType, ...DocumentType[]]),
  title: z.string().min(1, 'Title required'),
  reference_number: z.string().optional(),
  issuer: z.string().optional(),
  issued_date: z.string().optional(),
  expiry_date: z.string().min(1, 'Expiry date is required — this is what gets you reminded'),
  cost: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const DEFAULT_TITLE_FOR_TYPE: Record<DocumentType, string> = {
  'registration': 'Vehicle Registration',
  'road-tax': 'Road Tax',
  'inspection': 'Inspection Certificate',
  'warranty': 'Manufacturer Warranty',
  'roadside-assistance': 'Roadside Assistance',
  'drivers-license': "Driver's License",
  'other': '',
}

export default function Documents() {
  const [documents, setDocuments] = useState<VehicleDocument[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleDocument | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const { settings } = useSettings()
  const { currentVehicleId } = useVehicles()
  const currency = settings.currency

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { doc_type: 'registration', expiry_date: '' },
  })

  async function load() {
    const data = await window.api.documents.getAll()
    setDocuments(data)
  }

  useEffect(() => { load() }, [currentVehicleId])

  function openAdd() {
    setEditing(null)
    setPhotos([])
    reset({
      doc_type: 'registration',
      title: DEFAULT_TITLE_FOR_TYPE['registration'],
      reference_number: '',
      issuer: '',
      issued_date: '',
      expiry_date: '',
      cost: undefined,
      notes: '',
    })
    setOpen(true)
  }

  function openEdit(doc: VehicleDocument) {
    setEditing(doc)
    setPhotos(doc.photos ?? [])
    reset({
      doc_type: doc.doc_type,
      title: doc.title,
      reference_number: doc.reference_number ?? '',
      issuer: doc.issuer ?? '',
      issued_date: doc.issued_date ?? '',
      expiry_date: doc.expiry_date,
      cost: doc.cost ?? undefined,
      notes: doc.notes ?? '',
    })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      reference_number: data.reference_number || null,
      issuer: data.issuer || null,
      issued_date: data.issued_date || null,
      cost: data.cost ?? null,
      notes: data.notes || null,
      photos,
    }
    if (editing) {
      await window.api.documents.update(editing.id, payload)
      toast.success('Document updated')
    } else {
      await window.api.documents.add(payload)
      toast.success('Document added')
    }
    setOpen(false)
    load()
  }

  async function handleDelete() {
    if (deleteId === null) return
    await window.api.documents.delete(deleteId)
    toast.success('Document deleted')
    setDeleteId(null)
    load()
  }

  const docType = watch('doc_type')
  const titleValue = watch('title')

  // Auto-fill title when the type changes (only if title is empty or matches the previous default).
  function onTypeChange(t: DocumentType) {
    setValue('doc_type', t)
    if (!titleValue || Object.values(DEFAULT_TITLE_FOR_TYPE).includes(titleValue)) {
      setValue('title', DEFAULT_TITLE_FOR_TYPE[t])
    }
  }

  const overdue = documents.filter(d => d.status === 'overdue')
  const dueSoon = documents.filter(d => d.status === 'due-soon')
  const ok = documents.filter(d => d.status === 'ok')

  function getStatusBadge(d: VehicleDocument) {
    if (d.status === 'overdue') return <Badge variant="danger">Expired</Badge>
    if (d.status === 'due-soon') return <Badge variant="warning">Expires soon</Badge>
    return <Badge variant="success">Active</Badge>
  }

  function DocumentCard({ doc }: { doc: VehicleDocument }) {
    return (
      <Card className={
        doc.status === 'overdue' ? 'border-red-500/30' :
        doc.status === 'due-soon' ? 'border-amber-500/30' : ''
      }>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-foreground">{doc.title}</span>
                <Badge variant="outline" className="text-xs">{DOCUMENT_TYPE_LABELS[doc.doc_type]}</Badge>
                {getStatusBadge(doc)}
              </div>
              <p className="text-sm">
                {doc.status === 'overdue'
                  ? <span className="text-red-400">Expired {Math.abs(doc.days_remaining ?? 0)} day(s) ago</span>
                  : <span className="text-muted-foreground">
                      Expires {formatDate(doc.expiry_date)} · {doc.days_remaining} day(s) remaining
                    </span>}
              </p>
              {doc.reference_number && (
                <p className="text-xs text-muted-foreground mt-1">Ref: {doc.reference_number}</p>
              )}
              {doc.issuer && (
                <p className="text-xs text-muted-foreground">Issued by {doc.issuer}</p>
              )}
              {doc.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">{doc.notes}</p>
              )}
              {doc.photos?.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  📎 {doc.photos.length} photo{doc.photos.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {doc.cost !== null && doc.cost !== undefined && doc.cost > 0 && (
                <span className="text-sm font-medium">{formatCurrency(doc.cost, currency)}</span>
              )}
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(doc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
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
          <h1 className="text-2xl font-bold">Documents & Renewals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registration, road tax, inspection — anything with an expiry date.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileBadge2}
          title="No documents tracked yet"
          description="Track expiry dates for your registration, road tax, inspection certificate, and license — and get reminded before they lapse."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Document</Button>}
        />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Expired ({overdue.length})
              </h2>
              {overdue.map(d => <DocumentCard key={d.id} doc={d} />)}
            </div>
          )}
          {dueSoon.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                <FileBadge2 className="h-4 w-4" /> Expires Within 30 Days ({dueSoon.length})
              </h2>
              {dueSoon.map(d => <DocumentCard key={d.id} doc={d} />)}
            </div>
          )}
          {ok.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-green-400 flex items-center gap-1.5">
                <FileBadge2 className="h-4 w-4" /> Active ({ok.length})
              </h2>
              {ok.map(d => <DocumentCard key={d.id} doc={d} />)}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Document' : 'Add Document'}</DialogTitle>
            <DialogDescription>
              The expiry date is what triggers reminders — make sure it's set correctly.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={docType} onValueChange={v => onTypeChange(v as DocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issued Date</Label>
                <Input type="date" {...register('issued_date')} max={todayISO()} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date *</Label>
                <Input type="date" {...register('expiry_date')} />
                {errors.expiry_date && <p className="text-xs text-destructive">{errors.expiry_date.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reference Number</Label>
                <Input placeholder="Certificate / policy #" {...register('reference_number')} />
              </div>
              <div className="space-y-1.5">
                <Label>Issuer</Label>
                <Input placeholder="DMV, etc." {...register('issuer')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cost ({currency})</Label>
              <Input type="number" step="0.01" {...register('cost')} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} {...register('notes')} />
            </div>
            <PhotoUpload
              value={photos}
              onChange={setPhotos}
              category="documents"
              multiple
              label="Document Photos / Scans"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Add Document'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={v => !v && setDeleteId(null)}
        title="Delete this document?"
        description="The record and all photos will be removed."
        onConfirm={handleDelete}
      />
    </div>
  )
}
