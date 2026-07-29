// core-api used naive (timezone-less) DateTime throughout. To preserve that behavior client-side
// without UTC-shift bugs (Date.toISOString() converts to UTC, which would shift a midnight
// timestamp back a day in negative-offset zones like Brazil), every date stored in or read from
// PGlite goes through these helpers instead of toISOString()/plain `new Date(str)`.

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toNaiveTimestamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function parseNaiveTimestamp(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

export function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function addMonths(d: Date, months: number): Date {
  const result = new Date(d)
  result.setMonth(result.getMonth() + months)
  return result
}

export function addDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

export function isSameYearMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() + 1 === month
}

export function yearMonthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}
