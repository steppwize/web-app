import { formatCurrency } from '../utils/currency'
import type { CategorySlice } from '../utils/categoryBreakdown'

const SIZE = 84
const STROKE_WIDTH = 12
const GAP_DEGREES = 3

function DonutChart({
  slices,
  total,
  selectedKeys,
}: {
  slices: CategorySlice[]
  total: number
  selectedKeys: Set<string>
}) {
  const radius = (SIZE - STROKE_WIDTH) / 2
  const circumference = 2 * Math.PI * radius
  const gapFraction = slices.length > 1 ? GAP_DEGREES / 360 : 0
  const hasSelection = selectedKeys.size > 0

  let cumulative = 0

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {slices.map((slice) => {
            const sliceFraction = slice.percentage / 100
            const visibleFraction = Math.max(sliceFraction - gapFraction, 0.002)
            const dash = visibleFraction * circumference
            const offset = -cumulative * circumference
            cumulative += sliceFraction
            return (
              <circle
                key={slice.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                strokeOpacity={hasSelection && !selectedKeys.has(slice.key) ? 0.25 : 1}
              />
            )
          })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] text-muted">Gasto</span>
        <span className="text-[11px] font-bold text-white">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

function CategoryLegend({
  slices,
  selectedKeys,
  onToggle,
}: {
  slices: CategorySlice[]
  selectedKeys: Set<string>
  onToggle: (key: string) => void
}) {
  const hasSelection = selectedKeys.size > 0

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      {slices.map((slice) => {
        const isSelected = selectedKeys.has(slice.key)
        return (
          <button
            key={slice.key}
            type="button"
            onClick={() => onToggle(slice.key)}
            className={`flex items-center gap-2 min-w-0 -mx-1 px-1 py-1 rounded-md text-left transition-opacity ${
              hasSelection && !isSelected ? 'opacity-40' : ''
            } ${isSelected ? 'bg-white/5' : ''}`}
          >
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="flex-1 min-w-0 truncate text-xs text-white">{slice.label}</span>
            <span className="text-xs font-semibold text-muted shrink-0">{slice.percentage.toFixed(0)}%</span>
          </button>
        )
      })}
    </div>
  )
}

export function CategoryBreakdownChart({
  slices,
  selectedKeys,
  onToggle,
}: {
  slices: CategorySlice[]
  selectedKeys: Set<string>
  onToggle: (key: string) => void
}) {
  if (slices.length === 0) return null
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="flex items-center gap-4">
      <DonutChart slices={slices} total={total} selectedKeys={selectedKeys} />
      <CategoryLegend slices={slices} selectedKeys={selectedKeys} onToggle={onToggle} />
    </div>
  )
}
