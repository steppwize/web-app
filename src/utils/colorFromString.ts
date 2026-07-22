const PALETTE = ['#7C5CFC', '#22C55E', '#F59E0B', '#EC4899', '#6366F1', '#0EA5E9', '#EF4444', '#14B8A6']

// Selectable swatches for category/tag color pickers.
export const COLOR_SWATCHES = [...PALETTE, '#8B8FA8', '#F97316', '#84CC16', '#A855F7']

export function colorFromString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
