import fs from 'fs'

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
