const GRADIENTS: [string, string][] = [
  ['#7C3FBB', '#4C1A8A'],
  ['#2A2A2A', '#1A1A1A'],
  ['#1E3A8A', '#0F1D4A'],
  ['#065F46', '#022C22'],
  ['#9A3412', '#431407'],
  ['#831843', '#3B0A21'],
]

export function gradientFromString(value: string): [string, string] {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return GRADIENTS[hash % GRADIENTS.length]
}
