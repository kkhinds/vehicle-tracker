import { useState, useEffect } from 'react'
import { Upload, X, Eye, FileText, FileImage, File as FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhotoUploadProps {
  value: string[]
  onChange: (paths: string[]) => void
  category: string
  multiple?: boolean
  label?: string
}

interface Thumb {
  path: string
  kind: 'image' | 'pdf' | 'other'
  ext: string
  /** Only populated for kind='image'. */
  data: string | null
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'svg'])
const PDF_EXTS = new Set(['pdf'])

function basename(p: string): string {
  const norm = p.replace(/\\/g, '/')
  const parts = norm.split('/')
  return parts[parts.length - 1] || p
}

function getExt(p: string): string {
  const name = basename(p)
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

function classify(path: string): { kind: Thumb['kind']; ext: string } {
  const ext = getExt(path)
  if (IMAGE_EXTS.has(ext)) return { kind: 'image', ext }
  if (PDF_EXTS.has(ext)) return { kind: 'pdf', ext }
  return { kind: 'other', ext: ext || 'file' }
}

export default function PhotoUpload({
  value, onChange, category, multiple = false, label = 'Photos'
}: PhotoUploadProps) {
  const [thumbs, setThumbs] = useState<Thumb[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const results: Thumb[] = []
      for (const path of value) {
        const { kind, ext } = classify(path)
        // Only fetch the binary for actual images — PDFs/other don't render in <img>.
        const data = kind === 'image' ? await window.api.files.getImageData(path) : null
        results.push({ path, kind, ext, data })
      }
      if (!cancelled) setThumbs(results)
    }
    load()
    return () => { cancelled = true }
  }, [value])

  async function handleAdd() {
    setLoading(true)
    try {
      const selected = await window.api.files.openDialog({
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: 'Documents', extensions: ['pdf'] },
        ],
        multiple,
      })
      if (!selected.length) return

      const savedPaths: string[] = []
      for (const sourcePath of selected) {
        const savedPath = await window.api.files.savePhoto(sourcePath, category)
        savedPaths.push(savedPath)
      }
      onChange(multiple ? [...value, ...savedPaths] : savedPaths)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(path: string) {
    onChange(value.filter(p => p !== path))
    await window.api.files.deleteFile(path)
  }

  function renderPreview(thumb: Thumb) {
    // Image with successfully-loaded preview data
    if (thumb.kind === 'image' && thumb.data) {
      return <img src={thumb.data} alt="" className="h-full w-full object-cover" />
    }
    // Image but data failed to load — show image placeholder, not a broken-image icon
    if (thumb.kind === 'image') {
      return (
        <div className="h-full w-full bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <FileImage className="h-7 w-7" />
          <span className="text-[10px] uppercase tracking-wide">{thumb.ext || 'image'}</span>
        </div>
      )
    }
    // PDF
    if (thumb.kind === 'pdf') {
      return (
        <div className="h-full w-full bg-red-500/10 text-red-400 flex flex-col items-center justify-center gap-1">
          <FileText className="h-7 w-7" />
          <span className="text-[10px] font-semibold tracking-wide">PDF</span>
        </div>
      )
    }
    // Other / unknown
    return (
      <div className="h-full w-full bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground">
        <FileIcon className="h-7 w-7" />
        <span className="text-[10px] uppercase tracking-wide truncate max-w-full px-1">{thumb.ext || 'file'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {thumbs.map(thumb => (
          <div
            key={thumb.path}
            className="relative group h-20 w-20 rounded-md overflow-hidden border border-border"
            title={basename(thumb.path)}
          >
            {renderPreview(thumb)}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => window.api.files.openFile(thumb.path)}
                className="p-1 rounded bg-white/20 hover:bg-white/40 transition-colors"
                title="Open"
              >
                <Eye className="h-3 w-3 text-white" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(thumb.path)}
                className="p-1 rounded bg-white/20 hover:bg-red-500/60 transition-colors"
                title="Remove"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          </div>
        ))}
        {(multiple || value.length === 0) && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={loading}
            className={cn(
              'h-20 w-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs">{loading ? '...' : 'Add'}</span>
          </button>
        )}
      </div>
    </div>
  )
}
