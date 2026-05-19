import { useState } from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  /** ISO date string (yyyy-MM-dd) or empty string. */
  value: string | null | undefined
  /** Always called with an ISO date string (yyyy-MM-dd) or empty string. */
  onChange: (value: string) => void
  /** Placeholder text when no date is selected. */
  placeholder?: string
  disabled?: boolean
  /** Show a clear button when a date is set. Default true. */
  allowClear?: boolean
  /** Disable dates after this point (ISO yyyy-MM-dd). */
  max?: string
  /** Disable dates before this point (ISO yyyy-MM-dd). */
  min?: string
  className?: string
  id?: string
}

function parse(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const d = parseISO(value)
  return isValid(d) ? d : undefined
}

function toISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  allowClear = true,
  max,
  min,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parse(value)
  const minDate = parse(min)
  const maxDate = parse(max)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-10 w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1">
            {selected ? format(selected, 'PPP') /* e.g. "May 19, 2026" */ : placeholder}
          </span>
          {allowClear && selected && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onChange('')
              }}
              className="ml-2 rounded-sm opacity-70 hover:opacity-100"
              aria-label="Clear date"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toISO(d))
              setOpen(false)
            }
          }}
          disabled={(date) => {
            if (minDate && date < minDate) return true
            if (maxDate && date > maxDate) return true
            return false
          }}
          captionLayout="dropdown-buttons"
          fromYear={1990}
          toYear={new Date().getFullYear() + 10}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
