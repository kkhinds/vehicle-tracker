import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, FileText, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PhotoUpload from '@/components/shared/PhotoUpload'
import EmptyState from '@/components/shared/EmptyState'
import { useVehicles } from '@/hooks/useVehicles'
import { formatDate, todayISO } from '@/lib/utils'
import type { Note } from '@/types'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional(),
  date: z.string().min(1),
})
type FormData = z.infer<typeof schema>

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [attachments, setAttachments] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const { currentVehicleId } = useVehicles()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: todayISO() },
  })

  async function load() {
    const data = await window.api.notes.getAll()
    setNotes(data)
  }

  useEffect(() => { load() }, [currentVehicleId])

  useEffect(() => {
    if (!search.trim()) {
      load()
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const results = await window.api.notes.search(search.trim())
      setNotes(results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  function openAdd() {
    setEditing(null)
    setAttachments([])
    reset({ date: todayISO(), title: '', body: '' })
    setOpen(true)
  }

  function openEdit(note: Note) {
    setEditing(note)
    setAttachments(note.attachments ?? [])
    reset({ title: note.title, body: note.body ?? '', date: note.date })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    const payload = { ...data, body: data.body || null, attachments }
    if (editing) {
      await window.api.notes.update(editing.id, payload)
      toast.success('Note updated')
    } else {
      await window.api.notes.add(payload)
      toast.success('Note added')
    }
    setOpen(false)
    load()
  }

  async function handleDelete() {
    if (deleteId === null) return
    await window.api.notes.delete(deleteId)
    toast.success('Note deleted')
    setDeleteId(null)
    load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes & Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">{notes.length} notes</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Note
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search notes..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {notes.length === 0 && !searching ? (
        <EmptyState
          icon={FileText}
          title={search ? 'No notes found' : 'No notes yet'}
          description={search ? 'Try a different search term.' : 'Add notes for warranty info, contacts, and more.'}
          action={!search ? <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Note</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map(note => (
            <Card key={note.id} className="cursor-pointer hover:border-primary/50 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{note.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(note.date)}</p>
                    {note.body && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">{note.body}</p>
                    )}
                    {note.attachments?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        📎 {note.attachments.length} attachment{note.attachments.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(note)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(note.id)}>
                      <Trash2 className="h-3 w-3" />
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
            <DialogTitle>{editing ? 'Edit Note' : 'Add Note'}</DialogTitle>
            <DialogDescription>Save warranty info, contacts, or any other reference notes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="e.g. Warranty information" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register('date')} />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                placeholder="Add your notes here..."
                rows={6}
                className="resize-y"
                {...register('body')}
              />
            </div>
            <PhotoUpload
              value={attachments}
              onChange={setAttachments}
              category="notes"
              multiple
              label="Attachments (photos, documents)"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Add Note'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={v => !v && setDeleteId(null)}
        title="Delete note?"
        description="This will permanently delete this note."
        onConfirm={handleDelete}
      />
    </div>
  )
}
