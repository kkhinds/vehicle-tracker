import { ipcMain } from 'electron'
import { getDb } from '../db'

interface NoteRow {
  id: number
  title: string
  body: string | null
  date: string
  created_at: string
  updated_at: string
}

interface AttachmentRow {
  file_path: string
}

function getAttachments(db: ReturnType<typeof import('../db').getDb>, noteId: number): string[] {
  return (db.prepare('SELECT file_path FROM note_attachments WHERE note_id = ?').all(noteId) as AttachmentRow[])
    .map(r => r.file_path)
}

export function registerNotesHandlers(): void {
  const db = getDb()

  ipcMain.handle('notes:getAll', () => {
    const rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as NoteRow[]
    return rows.map(row => ({ ...row, attachments: getAttachments(db, row.id) }))
  })

  ipcMain.handle('notes:search', (_, query: string) => {
    const q = `%${query}%`
    const rows = db.prepare(
      "SELECT * FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY updated_at DESC"
    ).all(q, q) as NoteRow[]
    return rows.map(row => ({ ...row, attachments: getAttachments(db, row.id) }))
  })

  ipcMain.handle('notes:add', (_, note: Omit<NoteRow, 'id' | 'created_at' | 'updated_at'> & { attachments: string[] }) => {
    const { attachments, ...data } = note
    const result = db.prepare(
      'INSERT INTO notes (title, body, date) VALUES (@title, @body, @date)'
    ).run({ ...data, body: data.body ?? null })

    const id = result.lastInsertRowid as number
    const insertAttachment = db.prepare('INSERT INTO note_attachments (note_id, file_path) VALUES (?, ?)')
    for (const file of attachments ?? []) {
      insertAttachment.run(id, file)
    }

    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow
    return { ...row, attachments: getAttachments(db, id) }
  })

  ipcMain.handle('notes:update', (_, id: number, note: Partial<NoteRow & { attachments: string[] }>) => {
    const current = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow
    if (!current) return

    const merged = { ...current, ...note }
    db.prepare(`
      UPDATE notes SET title=@title, body=@body, date=@date, updated_at=datetime('now') WHERE id=@id
    `).run({ ...merged, id })

    if (note.attachments !== undefined) {
      db.prepare('DELETE FROM note_attachments WHERE note_id = ?').run(id)
      const insertAttachment = db.prepare('INSERT INTO note_attachments (note_id, file_path) VALUES (?, ?)')
      for (const file of note.attachments) {
        insertAttachment.run(id, file)
      }
    }
  })

  ipcMain.handle('notes:delete', (_, id: number) => {
    db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  })
}
