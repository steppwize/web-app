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
