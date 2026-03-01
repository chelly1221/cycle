'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface RideTypeData {
  type: string
  count: number
  distanceKm: number
}

interface Props {
  data: RideTypeData[]
  typeLabels?: Record<string, string>
  labels?: { rides: string; distance: string; unit: string }
}

const COLORS = ['#ff6b8a', '#facc15', '#38bdf8', '#34d399', '#a78bfa', '#fb923c', '#94a3b8']

const DEFAULT_TYPE_LABELS: Record<string, string> = {
  RIDE: 'Road',
  VIRTUAL_RIDE: 'Virtual',
  MOUNTAIN_BIKE_RIDE: 'MTB',
  E_BIKE_RIDE: 'E-Bike',
  GRAVEL_RIDE: 'Gravel',
  HANDCYCLE: 'Handcycle',
  OTHER: 'Other',
}

const DEFAULT_LABELS = { rides: 'rides', distance: 'Distance', unit: 'km' }

export default function RideTypeChart({
  data,
  typeLabels = DEFAULT_TYPE_LABELS,
  labels = DEFAULT_LABELS,
}: Props) {
  const chartData = data.map((d) => ({
    ...d,
    label: typeLabels[d.type] ?? d.type,
  }))

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <ResponsiveContainer width="100%" height={240} className="max-w-[280px]">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            stroke="none"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#111',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#fff',
              fontSize: 13,
            }}
            formatter={(v: number, name: string) => [`${v} ${labels.rides}`, name]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-col gap-2 text-sm">
        {chartData.map((d, i) => (
          <div key={d.type} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-gray-300 w-24">{d.label}</span>
            <span className="text-gray-500 font-mono text-xs">
              {d.count} {labels.rides} · {d.distanceKm.toLocaleString()} {labels.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
