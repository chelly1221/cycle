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
import type { YearlyStat } from '@/lib/stats'

interface Props {
  data: YearlyStat[]
  metric?: 'distanceKm' | 'elevationM' | 'rides'
  metricLabels?: {
    distanceKm: { label: string; unit: string }
    elevationM: { label: string; unit: string }
    rides: { label: string; unit: string }
  }
}

const DEFAULT_LABELS = {
  distanceKm: { label: 'Distance', unit: 'km' },
  elevationM: { label: 'Elevation', unit: 'm' },
  rides: { label: 'Rides', unit: '' },
}

function formatYAxis(v: number): string {
  return v.toLocaleString()
}

export default function YearlyChart({ data, metric = 'distanceKm', metricLabels }: Props) {
  const labels = metricLabels ?? DEFAULT_LABELS
  const { label, unit } = labels[metric]
  const sorted = [...data].sort((a, b) => a.year - b.year)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={sorted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b8a" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
          <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff9db5" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fill: '#666', fontSize: 12 }}
          axisLine={{ stroke: '#333' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYAxis}
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
          fill="url(#barGradient)"
          radius={[4, 4, 0, 0]}
          activeBar={{ fill: 'url(#barGradientActive)', filter: 'url(#glow)' }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
