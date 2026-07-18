import { differenceInCalendarDays, parseISO, addMonths, format } from 'date-fns'

/**
 * Whole calendar days from today until a stored 'yyyy-MM-dd' date.
 * parseISO reads the date as LOCAL midnight; `new Date('yyyy-MM-dd')` would
 * read it as UTC and land a day off in negative-UTC timezones. Returns 0 today,
 * 1 tomorrow, negative once overdue.
 */
export function daysUntil(dateStr: string): number {
  return differenceInCalendarDays(parseISO(dateStr), new Date())
}

/** 'yyyy-MM-dd' + N months, as a local 'yyyy-MM-dd'. */
export function addMonthsISO(dateStr: string, months: number): string {
  return format(addMonths(parseISO(dateStr), months), 'yyyy-MM-dd')
}
