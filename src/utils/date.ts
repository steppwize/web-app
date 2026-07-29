const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const WEEKDAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

export function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export function formatMonthAbbr(month: number): string {
  return MONTH_ABBR[month - 1]
}

// dateIso may be date-only ("2026-07-01") or a naive timestamp ("2026-07-01T10:00:00"). The bare
// `Date` constructor parses date-only strings as UTC midnight, which local getters then read back
// a day early in negative-offset zones like Brazil — so we pull the Y/M/D out ourselves and build
// the Date from local components instead of going through that UTC-ambiguous parse.
function parseDateOnlyLocal(dateIso: string): Date {
  const [y, m, d] = dateIso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatShortDate(dateIso: string): string {
  const date = parseDateOnlyLocal(dateIso)
  return `${String(date.getDate()).padStart(2, '0')} ${MONTH_ABBR[date.getMonth()]}`
}

export function formatFullDate(dateIso: string): string {
  const date = parseDateOnlyLocal(dateIso)
  return `${String(date.getDate()).padStart(2, '0')} ${MONTH_ABBR[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDayHeader(dateIso: string): string {
  const date = parseDateOnlyLocal(dateIso)
  const weekday = WEEKDAY_NAMES[date.getDay()]
  const day = date.getDate()
  const month = MONTH_NAMES[date.getMonth()].toUpperCase()
  return `${weekday}, ${day} DE ${month}`
}
