import { useState, useEffect } from 'react'
import { Upload, X, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PhotoUploadProps {
  value: string[]
  onChange: (paths: string[]) => void
  category: string
  multiple?: boolean
  label?: string
}

interface PhotoThumb {
  path: string
  data: string | null
}

export default function PhotoUpload({
  value, onChange, category, multiple = false, label = 'Photos'
}: PhotoUploadProps) {
  const [thumbs, setThumbs] = useState<PhotoThumb[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const results: PhotoThumb[] = []
      for (const path of value) {
        const data = await window.api.files.getImageData(path)
        results.push({ path, data })
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

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {thumbs.map(({ path, data }) => (
          <div key={path} className="relative group h-20 w-20 rounded-md overflow-hidden border border-border">
            {data ? (
              <img src={data} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                File
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => window.api.files.openFile(path)}
                className="p-1 rounded bg-white/20 hover:bg-white/40 transition-colors"
              >
                <Eye className="h-3 w-3 text-white" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(path)}
                className="p-1 rounded bg-white/20 hover:bg-red-500/60 transition-colors"
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
