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

function formatDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [y, m] = dateStr.split('-')
  return `${months[parseInt(m, 10) - 1] ?? ''} ${y.slice(2)}`
}

export default function CumulativeChart({ data, labels = DEFAULT_LABELS }: Props) {
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
          tickFormatter={formatDate}
          tick={{ fill: '#666', fontSize: 11 }}
          axisLine={{ stroke: '#333' }}
          tickLine={false}
          interval="preserveStartEnd"
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
          labelFormatter={formatDate}
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
