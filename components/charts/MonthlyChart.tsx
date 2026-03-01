'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface MonthlyData {
  month: number
  rides: number
  distanceKm: number
  elevationM: number
}

interface Props {
  data: MonthlyData[]
  metric?: 'distanceKm' | 'elevationM' | 'rides'
  monthNames?: string[]
  metricLabels?: {
    distanceKm: { label: string; unit: string }
    elevationM: { label: string; unit: string }
    rides: { label: string; unit: string }
  }
}

const DEFAULT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DEFAULT_LABELS = {
  distanceKm: { label: 'Distance', unit: 'km' },
  elevationM: { label: 'Elevation', unit: 'm' },
  rides: { label: 'Rides', unit: '' },
}

export default function MonthlyChart({
  data,
  metric = 'distanceKm',
  monthNames = DEFAULT_MONTHS,
  metricLabels,
}: Props) {
  const labels = metricLabels ?? DEFAULT_LABELS
  const { label, unit } = labels[metric]

  const chartData = data.map((d) => ({
    ...d,
    monthName: monthNames[d.month - 1] ?? `M${d.month}`,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="monthBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b8a" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
          <linearGradient id="monthBarGradientActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff9db5" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
          <filter id="monthGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis
          dataKey="monthName"
          tick={{ fill: '#666', fontSize: 12 }}
          axisLine={{ stroke: '#333' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => v.toLocaleString()}
          tick={{ fill: '#666', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#fff',
            fontSize: 13,
          }}
          formatter={(v: number) => [`${v.toLocaleString()}${unit ? ' ' + unit : ''}`, label]}
          labelStyle={{ color: '#999', marginBottom: 2 }}
        />
        <Bar
          dataKey={metric}
          fill="url(#monthBarGradient)"
          radius={[4, 4, 0, 0]}
          activeBar={{ fill: 'url(#monthBarGradientActive)', filter: 'url(#monthGlow)' }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
