'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCountryName } from '@/lib/countryNames'

export interface RideRow {
  name: string
  slug: string
  country: string | null
  countryCode: string | null
  distanceM: number
  elevationM: number
  movingTimeSec: number
  startedAt: Date | string
  type: string
  averageSpeed: number | null
  averageWatts: number | null
}

type SortKey = 'date' | 'distance' | 'elevation' | 'time' | 'speed' | 'watts'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  )
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}m` : `${m}m`
}

function getSortValue(ride: RideRow, key: SortKey): number {
  switch (key) {
    case 'date': return new Date(ride.startedAt).getTime()
    case 'distance': return ride.distanceM
    case 'elevation': return ride.elevationM
    case 'time': return ride.movingTimeSec
    case 'speed': return ride.averageSpeed ?? 0
    case 'watts': return ride.averageWatts ?? 0
  }
}

function rideHref(ride: RideRow): string {
  const countrySlug = ride.country?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown'
  return `/rides/${countrySlug}/${ride.slug}`
}

const headerClass = 'px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-300 transition-colors whitespace-nowrap'
const cellClass = 'px-3 py-2.5 whitespace-nowrap'

export default function RideTable({ rides }: { rides: RideRow[] }) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [searchQuery, setSearchQuery] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const filtered = searchQuery.trim()
    ? rides.filter(r => r.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : rides

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a, sortKey)
    const bv = getSortValue(b, sortKey)
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length

  // Reset visible count when sort changes
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setVisibleCount(PAGE_SIZE)
  }

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + PAGE_SIZE, sorted.length))
  }, [sorted.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'desc' ? ' \u25BC' : ' \u25B2') : ''

  const hasWatts = filtered.some(r => r.averageWatts && r.averageWatts > 0)

  const handleRowClick = (ride: RideRow, e: React.MouseEvent) => {
    const href = rideHref(ride)
    if (e.metaKey || e.ctrlKey) {
      window.open(href, '_blank')
    } else {
      router.push(href)
    }
  }

  return (
    <>
      <div className="relative mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE) }}
          placeholder="라이드 검색..."
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 pl-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); setVisibleCount(PAGE_SIZE) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-800">
              <th
                className={`${headerClass} text-left pl-4 sm:pl-3`}
                onClick={() => toggleSort('date')}
              >
                날짜{arrow('date')}
              </th>
              <th className={`${headerClass} text-left`}>
                라이드
              </th>
              <th
                className={`${headerClass} text-right`}
                onClick={() => toggleSort('distance')}
              >
                거리{arrow('distance')}
              </th>
              <th
                className={`${headerClass} text-right`}
                onClick={() => toggleSort('elevation')}
              >
                고도{arrow('elevation')}
              </th>
              <th
                className={`${headerClass} text-right`}
                onClick={() => toggleSort('time')}
              >
                시간{arrow('time')}
              </th>
              <th
                className={`${headerClass} text-right`}
                onClick={() => toggleSort('speed')}
              >
                속도{arrow('speed')}
              </th>
              {hasWatts && (
                <th
                  className={`${headerClass} text-right pr-4 sm:pr-3`}
                  onClick={() => toggleSort('watts')}
                >
                  W{arrow('watts')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((ride) => {
              const d = new Date(ride.startedAt)
              const month = d.getMonth() + 1
              const day = d.getDate()
              const year = d.getFullYear()
              const flag = countryFlag(ride.countryCode)
              const countryName = getCountryName(ride.countryCode, 'ko', ride.country ?? '')

              return (
                <tr
                  key={ride.slug}
                  onClick={(e) => handleRowClick(ride, e)}
                  className="border-b border-gray-800/50 hover:bg-gray-900/60 transition-colors cursor-pointer group"
                >
                  <td className={`${cellClass} pl-4 sm:pl-3 text-sm text-gray-500 font-mono tabular-nums`}>
                    <span className="text-gray-400">{month}.{day}</span>
                    <span className="text-gray-600 ml-1 text-xs">{year}</span>
                  </td>
                  <td className={`${cellClass} text-sm`}>
                    <span className="mr-1.5">{flag}</span>
                    <a
                      href={rideHref(ride)}
                      onClick={(e) => e.preventDefault()}
                      className="text-white group-hover:text-strava transition-colors font-medium"
                    >
                      {ride.name}
                    </a>
                    <span className="text-gray-600 ml-2 text-xs hidden lg:inline">
                      {countryName}
                    </span>
                  </td>
                  <td className={`${cellClass} text-right text-sm font-mono tabular-nums text-white`}>
                    {(ride.distanceM / 1000).toFixed(1)}
                    <span className="text-gray-600 text-xs ml-0.5">km</span>
                  </td>
                  <td className={`${cellClass} text-right text-sm font-mono tabular-nums text-white`}>
                    {Math.round(ride.elevationM).toLocaleString()}
                    <span className="text-gray-600 text-xs ml-0.5">m</span>
                  </td>
                  <td className={`${cellClass} text-right text-sm font-mono tabular-nums text-gray-300`}>
                    {formatDuration(ride.movingTimeSec)}
                  </td>
                  <td className={`${cellClass} text-right text-sm font-mono tabular-nums text-gray-300`}>
                    {ride.averageSpeed
                      ? (ride.averageSpeed * 3.6).toFixed(1)
                      : '-'}
                  </td>
                  {hasWatts && (
                    <td className={`${cellClass} text-right pr-4 sm:pr-3 text-sm font-mono tabular-nums text-gray-400`}>
                      {ride.averageWatts ? Math.round(ride.averageWatts) : '-'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <div className="h-5 w-5 border-2 border-gray-700 border-t-strava rounded-full animate-spin" />
        </div>
      )}
    </>
  )
}
