import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Shield, AlertCircle, ArchiveX } from 'lucide-react'
import { toast } from 'sonner'
import { differenceInDays } from 'date-fns'
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
import PhotoUpload from '@/components/shared/PhotoUpload'
import EmptyState from '@/components/shared/EmptyState'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils'
import type { InsurancePolicy } from '@/types'

const schema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  policy_number: z.string().min(1, 'Policy number is required'),
  coverage_type: z.enum(['comprehensive', 'third-party', 'third-party-fire-theft']),
  premium_amount: z.coerce.number().positive('Premium must be greater than 0'),
  payment_frequency: z.enum(['monthly', 'quarterly', 'annually']),
  start_date: z.string().min(1, 'Start date is required'),
  renewal_date: z.string().min(1, 'Renewal date is required'),
  agent_name: z.string().optional(),
  agent_contact: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
})
type FormData = z.infer<typeof schema>

const COVERAGE_LABELS: Record<string, string> = {
  comprehensive: 'Comprehensive',
  'third-party': 'Third Party',
  'third-party-fire-theft': 'Third Party, Fire & Theft',
}

export default function Insurance() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InsurancePolicy | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deactivateId, setDeactivateId] = useState<number | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const { settings } = useSettings()
  const currency = settings.currency

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      coverage_type: 'comprehensive',
      payment_frequency: 'annually',
      start_date: todayISO(),
      renewal_date: '',
      is_active: true,
    },
  })

  async function load() {
    const data = await window.api.insurance.getAll()
    setPolicies(data)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setPhotos([])
    reset({
      coverage_type: 'comprehensive',
      payment_frequency: 'annually',
      start_date: todayISO(),
      renewal_date: '',
      is_active: true,
    })
    setOpen(true)
  }

  function openEdit(policy: InsurancePolicy) {
    setEditing(policy)
    setPhotos(policy.photos ?? [])
    reset({
      provider: policy.provider,
      policy_number: policy.policy_number,
      coverage_type: policy.coverage_type,
      premium_amount: policy.premium_amount,
      payment_frequency: policy.payment_frequency,
      start_date: policy.start_date,
      renewal_date: policy.renewal_date,
      agent_name: policy.agent_name ?? '',
      agent_contact: policy.agent_contact ?? '',
      notes: policy.notes ?? '',
      is_active: policy.is_active,
    })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      photos,
      agent_name: data.agent_name || null,
      agent_contact: data.agent_contact || null,
      notes: data.notes || null,
    }
    if (editing) {
      await window.api.insurance.update(editing.id, payload)
      toast.success('Policy updated')
    } else {
      await window.api.insurance.add(payload)
      toast.success('Policy added')
    }
    setOpen(false)
    load()
  }

  async function handleDelete() {
    if (deleteId === null) return
    await window.api.insurance.delete(deleteId)
    toast.success('Policy deleted')
    setDeleteId(null)
    load()
  }

  async function handleDeactivate() {
    if (deactivateId === null) return
    await window.api.insurance.deactivate(deactivateId)
    toast.success('Policy archived')
    setDeactivateId(null)
    load()
  }

  function getRenewalBadge(renewalDate: string) {
    const days = differenceInDays(new Date(renewalDate), new Date())
    if (days < 0) return <Badge variant="danger">Expired</Badge>
    if (days <= 30) return <Badge variant="warning">{days}d to renewal</Badge>
    return <Badge variant="success">{days} days</Badge>
  }

  const active = policies.filter(p => p.is_active)
  const inactive = policies.filter(p => !p.is_active)

  function PolicyCard({ policy }: { policy: InsurancePolicy }) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-foreground">{policy.provider}</span>
                <Badge variant="outline" className="text-xs">{COVERAGE_LABELS[policy.coverage_type] ?? policy.coverage_type}</Badge>
                {policy.is_active && getRenewalBadge(policy.renewal_date)}
              </div>
              <p className="text-xs text-muted-foreground">Policy #: {policy.policy_number}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-muted-foreground">
                <span>Premium: <span className="text-foreground font-medium">{formatCurrency(policy.premium_amount, currency)}/{policy.payment_frequency}</span></span>
                <span>Start: {formatDate(policy.start_date)}</span>
                <span>Renewal: <span className="text-foreground font-medium">{formatDate(policy.renewal_date)}</span></span>
                {policy.agent_name && <span>Agent: {policy.agent_name}</span>}
              </div>
              {policy.agent_contact && (
                <p className="text-xs text-muted-foreground mt-0.5">{policy.agent_contact}</p>
              )}
              {policy.notes && <p className="text-xs text-muted-foreground mt-1 italic">{policy.notes}</p>}
              {policy.photos?.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">📎 {policy.photos.length} document{policy.photos.length > 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(policy)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {policy.is_active && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Archive" onClick={() => setDeactivateId(policy.id)}>
                  <ArchiveX className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(policy.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
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
          <h1 className="text-2xl font-bold">Insurance Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">{active.length} active polic{active.length === 1 ? 'y' : 'ies'}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Policy
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="history">History ({inactive.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {active.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No active policies"
              description="Add your insurance policies to track renewals."
              action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Policy</Button>}
            />
          ) : (
            active.map(p => <PolicyCard key={p.id} policy={p} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-4">
          {inactive.length === 0 ? (
            <EmptyState icon={Shield} title="No archived policies" />
          ) : (
            inactive.map(p => <PolicyCard key={p.id} policy={p} />)
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Policy' : 'Add Insurance Policy'}</DialogTitle>
            <DialogDescription>Track an insurance policy with renewal, premium, and coverage details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Provider *</Label>
                <Input placeholder="e.g. ICBL" {...register('provider')} />
                {errors.provider && <p className="text-xs text-destructive">{errors.provider.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Policy Number *</Label>
                <Input {...register('policy_number')} />
                {errors.policy_number && <p className="text-xs text-destructive">{errors.policy_number.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Coverage Type *</Label>
                <Select value={watch('coverage_type')} onValueChange={v => setValue('coverage_type', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comprehensive">Comprehensive</SelectItem>
                    <SelectItem value="third-party">Third Party</SelectItem>
                    <SelectItem value="third-party-fire-theft">Third Party, Fire & Theft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Premium ({currency}) *</Label>
                <Input type="number" step="0.01" {...register('premium_amount')} />
                {errors.premium_amount && <p className="text-xs text-destructive">{errors.premium_amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Payment Frequency *</Label>
                <Select value={watch('payment_frequency')} onValueChange={v => setValue('payment_frequency', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input type="date" {...register('start_date')} />
              </div>
              <div className="space-y-1.5">
                <Label>Renewal Date *</Label>
                <Input type="date" {...register('renewal_date')} />
                {errors.renewal_date && <p className="text-xs text-destructive">{errors.renewal_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Agent / Broker</Label>
                <Input {...register('agent_name')} />
              </div>
              <div className="space-y-1.5">
                <Label>Agent Contact</Label>
                <Input placeholder="Phone or email" {...register('agent_contact')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} {...register('notes')} />
            </div>
            <PhotoUpload
              value={photos}
              onChange={setPhotos}
              category="insurance"
              multiple
              label="Policy Documents"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Add Policy'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={v => !v && setDeleteId(null)}
        title="Delete policy?"
        description="This will permanently delete this insurance policy."
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={deactivateId !== null}
        onOpenChange={v => !v && setDeactivateId(null)}
        title="Archive policy?"
        description="This will move the policy to history. You can still view it later."
        onConfirm={handleDeactivate}
        confirmLabel="Archive"
      />
    </div>
  )
}
