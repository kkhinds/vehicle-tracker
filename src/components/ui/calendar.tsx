import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, type DropdownProps } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

// Custom month/year dropdown component. react-day-picker's default is a
// native <select> which (a) doesn't inherit our dark theme reliably and
// (b) loses focus oddly when rendered inside a Radix Popover, so changes
// to the year/month don't always commit. This Radix-based replacement
// stays inside the popover's DOM tree and themes correctly.
function CalendarDropdown({ value, onChange, children }: DropdownProps) {
  const options = React.Children.toArray(children) as React.ReactElement<
    React.HTMLProps<HTMLOptionElement>
  >[]
  const selected = options.find(o => o.props.value === value)
  const handleChange = (next: string) => {
    const changeEvent = {
      target: { value: next },
    } as React.ChangeEvent<HTMLSelectElement>
    onChange?.(changeEvent)
  }

  return (
    <Select
      value={value?.toString()}
      onValueChange={handleChange}
    >
      <SelectTrigger className="h-7 w-auto gap-1 border-input px-2 text-sm focus:ring-0">
        <SelectValue>{selected?.props.children}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper">
        <ScrollArea className="h-80">
          {options.map((opt, idx) => (
            <SelectItem
              key={`${opt.props.value}-${idx}`}
              value={opt.props.value?.toString() ?? ''}
            >
              {opt.props.children}
            </SelectItem>
          ))}
        </ScrollArea>
      </SelectContent>
    </Select>
  )
}

// shadcn/ui calendar — react-day-picker v8 with Tailwind styling.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        // Hide the redundant "May 2026" label when month+year dropdowns are shown.
        caption_label: 'text-sm font-medium hidden',
        caption_dropdowns: 'flex justify-center gap-1',
        // Native <select> needs explicit dark-theme styling — otherwise it inherits
        // the OS default which renders white-on-white in dark mode on Windows.
        dropdown: 'inline-flex h-7 items-center rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
        dropdown_month: '',
        dropdown_year: '',
        // react-day-picker emits hidden "Month:" / "Year:" labels for screen
        // readers; they show by default if vhidden isn't styled to actually hide.
        vhidden: 'sr-only',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
        ),
        day_range_end: 'day-range-end',
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside: 'day-outside text-muted-foreground opacity-50',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle:
          'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        Dropdown: CalendarDropdown,
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
