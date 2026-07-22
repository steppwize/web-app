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

export function formatShortDate(dateIso: string): string {
  const date = new Date(dateIso)
  return `${String(date.getDate()).padStart(2, '0')} ${MONTH_ABBR[date.getMonth()]}`
}

export function formatFullDate(dateIso: string): string {
  const date = new Date(dateIso)
  return `${String(date.getDate()).padStart(2, '0')} ${MONTH_ABBR[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDayHeader(dateIso: string): string {
  const date = new Date(dateIso)
  const weekday = WEEKDAY_NAMES[date.getDay()]
  const day = date.getDate()
  const month = MONTH_NAMES[date.getMonth()].toUpperCase()
  return `${weekday}, ${day} DE ${month}`
}
