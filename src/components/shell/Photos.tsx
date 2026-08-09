import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/** Reads a downscaled copy of each file. PDFs stay as a labelled tile. */
function useThumbs(paths: string[]): Record<string, string | null> {
  const [data, setData] = useState<Record<string, string | null>>({})
  const key = paths.join('|')

  useEffect(() => {
    let cancelled = false
    Promise.all(paths.map(async p => [p, await window.api.files.getThumbnail(p)] as const))
      .then(pairs => { if (!cancelled) setData(Object.fromEntries(pairs)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return data
}

function isPdf(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf')
}

function Tile({ path, src, index, total, onRemove }: {
  path: string; src: string | null; index: number; total: number; onRemove?: () => void
}) {
  // The stored name is a timestamp, so position is the only thing worth saying.
  const label = total > 1 ? `Attachment ${index + 1} of ${total}` : 'Attachment'
  return (
    <div className="dl-thumb">
      <button
        className="dl-thumb-open"
        onClick={() => window.api.files.openFile(path)}
        aria-label={`${label} — open in the system viewer`}
        title="Open in the system viewer"
      >
        {isPdf(path) || !src
          ? <span className="dl-thumb-doc mono">{isPdf(path) ? 'PDF' : '?'}</span>
          : <img src={src} alt={label} />}
      </button>
      {onRemove && (
        <button className="dl-thumb-x" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()}`}>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  )
}

/**
 * Attach files to a record. Picking copies the file into the app's photo
 * folder straight away and returns the stored path — the caller keeps that
 * list and saves it with the record.
 */
export function PhotoPicker({ category, paths, onChange, multiple = true, label = 'Attach' }: {
  category: string
  paths: string[]
  onChange: (paths: string[]) => void
  multiple?: boolean
  label?: string
}) {
  const thumbs = useThumbs(paths)
  const [busy, setBusy] = useState(false)

  async function pick() {
    setBusy(true)
    try {
      const picked = await window.api.files.openDialog({ multiple })
      if (!picked.length) return
      const saved: string[] = []
      for (const src of picked) saved.push(await window.api.files.savePhoto(src, category))
      onChange(multiple ? [...paths, ...saved] : saved.slice(0, 1))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dl-field">
      <label>{multiple ? 'Attachments' : 'Receipt'}</label>
      <div className="dl-thumbs">
        {paths.map((p, i) => (
          <Tile
            key={p}
            path={p}
            src={thumbs[p] ?? null}
            index={i}
            total={paths.length}
            onRemove={() => onChange(paths.filter(x => x !== p))}
          />
        ))}
        <button className="dl-thumb-add" onClick={pick} disabled={busy}>
          {busy ? '…' : `+ ${label}`}
        </button>
      </div>
      <div className="dl-hint">photos or PDFs — copied into the app, originals stay put</div>
    </div>
  )
}

/** Read-only strip for the detail sheet. */
export function PhotoStrip({ paths }: { paths: string[] }) {
  const thumbs = useThumbs(paths)
  if (!paths.length) return null
  return (
    <div className="dl-thumbs" style={{ marginTop: 14 }}>
      {paths.map((p, i) => <Tile key={p} path={p} src={thumbs[p] ?? null} index={i} total={paths.length} />)}
    </div>
  )
}
