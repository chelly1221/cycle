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

interface ElevationPoint {
  distance: number // km
  altitude: number // metres
}

interface Props {
  data: ElevationPoint[]
  labels?: { elevation: string; kmSuffix: string }
}

const DEFAULT_LABELS = { elevation: 'Elevation', kmSuffix: ' km' }

export default function ElevationChart({ data, labels = DEFAULT_LABELS }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="elevGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6b8a" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#facc15" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="distance"
          tickFormatter={(v) => `${v}km`}
          tick={{ fill: '#999', fontSize: 11 }}
          axisLine={{ stroke: '#444' }}
        />
        <YAxis
          tickFormatter={(v) => `${v}m`}
          tick={{ fill: '#999', fontSize: 11 }}
          axisLine={{ stroke: '#444' }}
          width={48}
        />
        <Tooltip
          contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
          formatter={(value: number) => [`${value}m`, labels.elevation]}
          labelFormatter={(label) => `${label}${labels.kmSuffix}`}
        />
        <Area
          type="monotone"
          dataKey="altitude"
          stroke="#ff6b8a"
          strokeWidth={2}
          fill="url(#elevGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
