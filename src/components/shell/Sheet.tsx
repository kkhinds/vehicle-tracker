import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}

/**
 * Bottom sheet. Everything outside it is marked inert while open, which gives a
 * real focus trap (no manual Tab cycling) and keeps hidden controls out of the
 * tab order. Focus moves to the heading on open and returns to the trigger on
 * close.
 */
export default function Sheet({ open, title, subtitle, onClose, children }: SheetProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement as HTMLElement

    const outside = Array.from(document.body.children)
      .filter((el): el is HTMLElement => el instanceof HTMLElement && !el.dataset.sheetLayer)
    outside.forEach(el => { el.inert = true })
    headingRef.current?.focus()

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)

    return () => {
      outside.forEach(el => { el.inert = false })
      document.removeEventListener('keydown', onKey)
      lastFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  // Portalled to <body> so it sits outside #root — otherwise marking everything
  // outside the sheet inert would catch the sheet itself.
  return createPortal(
    <div data-sheet-layer="true">
      <div className="dl-scrim open" onClick={onClose} />
      <div className="dl-sheet open" role="dialog" aria-modal="true" aria-labelledby="dl-sheet-title">
        <div className="dl-grab" aria-hidden="true" />
        <h2 id="dl-sheet-title" ref={headingRef} tabIndex={-1}>{title}</h2>
        {subtitle && <div className="dl-sheet-meta">{subtitle}</div>}
        {children}
      </div>
    </div>,
    document.body
  )
}
