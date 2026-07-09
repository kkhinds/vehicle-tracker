import fs from 'fs'

type Db = ReturnType<typeof import('./db').getDb>

/**
 * Best-effort deletion of photo/attachment files from disk.
 *
 * Called by the domain delete handlers so that removing a record (or a whole
 * vehicle, which cascade-deletes its child rows) doesn't leave orphaned image
 * files behind in {userData}/photos/*. Missing files and unlink errors are
 * swallowed — a locked or already-gone file must never block the DB delete.
 */
export function deletePhotoFiles(paths: Array<string | null | undefined>): void {
  for (const p of paths) {
    if (!p) continue
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    } catch {
      /* ignore — best-effort cleanup */
    }
  }
}

/**
 * Replace a record's child photo/attachment rows with `newPaths`, unlinking any
 * files that were removed. Shared by the four update handlers; also the reason
 * PhotoUpload can stop deleting pre-existing files on remove (so cancelling an
 * edit no longer loses them — the delete happens here, only on save).
 */
export function replaceChildPaths(
  db: Db, table: string, fkCol: string, fkVal: number, col: string, newPaths: string[],
): void {
  const old = (db.prepare(`SELECT ${col} AS p FROM ${table} WHERE ${fkCol} = ?`).all<{ p: string }>(fkVal)).map(r => r.p)
  deletePhotoFiles(old.filter(p => !newPaths.includes(p)))
  db.prepare(`DELETE FROM ${table} WHERE ${fkCol} = ?`).run(fkVal)
  const insert = db.prepare(`INSERT INTO ${table} (${fkCol}, ${col}) VALUES (?, ?)`)
  for (const p of newPaths) insert.run(fkVal, p)
}
