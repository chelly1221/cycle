'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface CumulativePoint {
  date: string
  cumulativeKm: number
}

interface Props {
  data: CumulativePoint[]
  labels?: { distance: string; unit: string }
}

const DEFAULT_LABELS = { distance: 'Cumulative Distance', unit: 'km' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatTooltipDate(dateStr: string): string {
  const [y, m, day] = dateStr.split('-')
  return `${MONTHS[parseInt(m, 10) - 1] ?? ''} ${parseInt(day, 10)}, ${y}`
}

export default function CumulativeChart({ data, labels = DEFAULT_LABELS }: Props) {
  // Build year-only ticks: show only the first data point of each year
  const yearTicks: string[] = []
  let lastYear = ''
  for (const d of data) {
    const y = d.date.slice(0, 4)
    if (y !== lastYear) {
      yearTicks.push(d.date)
      lastYear = y
    }
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6b8a" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#facc15" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis
          dataKey="date"
          ticks={yearTicks}
          tickFormatter={(dateStr: string) => dateStr.slice(0, 4)}
          tick={{ fill: '#666', fontSize: 12 }}
          axisLine={{ stroke: '#333' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          tick={{ fill: '#666', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#fff',
            fontSize: 13,
          }}
          formatter={(v: string | number) => [`${Number(v).toLocaleString()} ${labels.unit}`, labels.distance]}
          labelFormatter={formatTooltipDate}
          labelStyle={{ color: '#999', marginBottom: 2 }}
        />
        <Area
          type="monotone"
          dataKey="cumulativeKm"
          stroke="#ff6b8a"
          strokeWidth={2}
          fill="url(#cumulativeGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
