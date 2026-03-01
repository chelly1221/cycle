'use client'

import { useState, useMemo } from 'react'

interface DailyData {
  date: string
  rides: number
  distanceKm: number
}

interface Props {
  data: DailyData[]
  labels?: {
    title: string
    rides: string
    km: string
    less: string
    more: string
    months: string[]
  }
}

const DEFAULT_LABELS = {
  title: 'Activity Heatmap',
  rides: 'rides',
  km: 'km',
  less: 'Less',
  more: 'More',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

const COLORS = ['#1a1a2e', '#4a1942', '#8b2252', '#c7385f', '#ff6b8a']
const CELL = 13
const GAP = 3
const ROWS = 7

function getColor(rides: number): string {
  if (rides === 0) return COLORS[0]
  if (rides === 1) return COLORS[1]
  if (rides === 2) return COLORS[2]
  if (rides <= 4) return COLORS[3]
  return COLORS[4]
}

export default function MonthlyHeatmap({ data, labels = DEFAULT_LABELS }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; above: boolean; text: string } | null>(null)

  const { cells, weeks, monthLabels } = useMemo(() => {
    const map = new Map<string, DailyData>()
    data.forEach((d) => map.set(d.date, d))

    const today = new Date()
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const start = new Date(end)
    start.setDate(start.getDate() - 364)

    // Align to Sunday
    const startDay = start.getDay()
    if (startDay !== 0) start.setDate(start.getDate() - startDay)

    const cells: Array<{
      date: string
      rides: number
      distanceKm: number
      col: number
      row: number
    }> = []

    const d = new Date(start)
    let col = 0
    while (d <= end) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const entry = map.get(dateStr)
      cells.push({
        date: dateStr,
        rides: entry?.rides ?? 0,
        distanceKm: entry?.distanceKm ?? 0,
        col,
        row: d.getDay(),
      })
      d.setDate(d.getDate() + 1)
      if (d.getDay() === 0) col++
    }

    const weeks = col + 1
    const monthLabelsArr: Array<{ label: string; col: number }> = []
    let lastMonth = -1
    cells.forEach((c) => {
      const m = parseInt(c.date.slice(5, 7), 10) - 1
      if (m !== lastMonth && c.row === 0) {
        monthLabelsArr.push({ label: labels.months[m], col: c.col })
        lastMonth = m
      }
    })

    return { cells, weeks, monthLabels: monthLabelsArr }
  }, [data, labels.months])

  const svgWidth = weeks * (CELL + GAP) + GAP
  const svgHeight = ROWS * (CELL + GAP) + GAP + 20

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgWidth}
        height={svgHeight}
        className="block"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text
            key={i}
            x={m.col * (CELL + GAP) + GAP}
            y={12}
            fill="#666"
            fontSize={10}
          >
            {m.label}
          </text>
        ))}

        {/* Cells */}
        {cells.map((c, i) => (
          <rect
            key={i}
            x={c.col * (CELL + GAP) + GAP}
            y={c.row * (CELL + GAP) + 20}
            width={CELL}
            height={CELL}
            rx={2}
            fill={getColor(c.rides)}
            className="transition-opacity"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const parent = e.currentTarget.closest('svg')?.getBoundingClientRect()
              if (parent) {
                const cx = rect.left - parent.left + CELL / 2
                const cy = rect.top - parent.top
                const above = cy > 36
                setTooltip({
                  x: cx,
                  y: above ? cy - 8 : cy + CELL + 24,
                  above,
                  text: `${c.date}: ${c.rides} ${labels.rides}, ${c.distanceKm} ${labels.km}`,
                })
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.max(0, tooltip.x - 80)}
              y={tooltip.above ? tooltip.y - 22 : tooltip.y}
              width={160}
              height={20}
              rx={4}
              fill="#111"
              stroke="#333"
            />
            <text
              x={Math.max(80, tooltip.x)}
              y={tooltip.above ? tooltip.y - 8 : tooltip.y + 14}
              fill="#fff"
              fontSize={10}
              textAnchor="middle"
            >
              {tooltip.text}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
        <span>{labels.less}</span>
        {COLORS.map((c, i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{ width: CELL, height: CELL, backgroundColor: c }}
          />
        ))}
        <span>{labels.more}</span>
      </div>
    </div>
  )
}
