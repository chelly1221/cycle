'use client'

import { useRef, useState, useEffect } from 'react'

export interface TimelineItem {
  flag: string
  countryName: string
  date: string
  totalRides: number
  distanceKm: number
  href: string
}

interface Props {
  items: TimelineItem[]
  ridesSuffix: string
}

const ITEM_MIN_WIDTH = 130

export default function CountryTimeline({ items, ridesSuffix }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(6)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setCols(Math.max(2, Math.floor(el.clientWidth / ITEM_MIN_WIDTH)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const rows: TimelineItem[][] = []
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols))

  // Connector position: center of first/last column
  const firstCenter = `${100 / (2 * cols)}%`
  const lastCenter = `${100 - 100 / (2 * cols)}%`

  return (
    <div ref={ref}>
      {rows.map((row, ri) => {
        const reversed = ri % 2 === 1
        return (
          <div key={ri}>
            <div className={`flex ${reversed ? 'flex-row-reverse' : ''}`}>
              {row.map((item, ci) => {
                const isStart = reversed ? ci === row.length - 1 : ci === 0
                const isEnd = reversed ? ci === 0 : ci === row.length - 1
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex-1 relative pt-6 pb-3 group"
                  >
                    {/* Horizontal dashed line segment */}
                    <div className={`absolute top-[7px] border-t border-dashed border-gray-700 ${
                      isStart && isEnd ? 'hidden' :
                      isStart ? 'left-1/2 right-0' :
                      isEnd ? 'left-0 right-1/2' :
                      'left-0 right-0'
                    }`} />
                    {/* Node dot */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[15px] h-[15px] rounded-full border-2 border-strava bg-gray-950 z-10 flex items-center justify-center group-hover:border-white transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-strava group-hover:bg-white transition-colors" />
                    </div>
                    {/* Content */}
                    <div className="text-center px-1">
                      <p className="text-xs text-gray-500 font-mono">{item.date}</p>
                      <p className="text-sm text-white font-medium mt-0.5 group-hover:text-strava transition-colors truncate">
                        {item.flag && <span className="mr-0.5">{item.flag}</span>}
                        {item.countryName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.totalRides}{ridesSuffix} · {item.distanceKm.toLocaleString()} km
                      </p>
                    </div>
                  </a>
                )
              })}
              {/* Pad incomplete row */}
              {row.length < cols && Array.from({ length: cols - row.length }).map((_, i) => (
                <div key={`pad-${i}`} className="flex-1" />
              ))}
            </div>
            {/* Vertical turn connector */}
            {ri < rows.length - 1 && (
              <div className="relative h-5">
                <div
                  className="absolute top-0 bottom-0 border-l border-dashed border-gray-700"
                  style={{ left: reversed ? firstCenter : lastCenter }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
