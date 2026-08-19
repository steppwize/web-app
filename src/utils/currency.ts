const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatCurrency(value: number): string {
  return formatter.format(value)
}

export function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? '+ ' : value < 0 ? '- ' : ''
  return `${sign}${formatter.format(Math.abs(value))}`
}

// One term of a "v1 + v2 - v3 = total" formula string — a negative term gets a literal "-" operator
// with its absolute value instead of "+ -", which reads as a plain double negative.
export function formatCurrencyTerm(value: number, isFirst: boolean): string {
  if (isFirst) return value < 0 ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(value)
  return value < 0 ? `- ${formatCurrency(Math.abs(value))}` : `+ ${formatCurrency(value)}`
}
