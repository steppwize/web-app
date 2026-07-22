const PALETTE = ['#7C5CFC', '#22C55E', '#F59E0B', '#EC4899', '#6366F1', '#0EA5E9', '#EF4444', '#14B8A6']

export function colorFromString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
