'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import type { RegionData } from '@/lib/regions'

export interface VirtualProgram {
  key: string
  label: string
}

interface Props {
  regions: RegionData[]
  activeRegion?: string
  activeCountry?: string
  activeVirtual?: boolean
  activeProgram?: string
  virtualPrograms?: VirtualProgram[]
  virtualLabel?: string
  locale: string
  basePath: string
  allLabel: string
}

const tabBase = 'px-4 py-1.5 rounded text-sm border transition-colors'
const tabActive = 'bg-strava border-strava text-white'
const tabInactive = 'border-gray-700 text-gray-400 hover:border-gray-500'

const dropdownBase =
  'absolute top-full left-0 mt-1 z-50 bg-gray-950 border border-gray-800 rounded-lg shadow-xl py-1 min-w-[140px]'
const dropdownItem = 'block px-4 py-2 text-sm transition-colors whitespace-nowrap'
const dropdownItemActive = 'text-strava bg-gray-900'
const dropdownItemInactive = 'text-gray-400 hover:text-white hover:bg-gray-900'

export default function RegionFilter({
  regions,
  activeRegion,
  activeCountry,
  activeVirtual,
  activeProgram,
  virtualPrograms,
  virtualLabel = 'Virtual',
  locale,
  basePath,
  allLabel,
}: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = (key: string) => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(key)
  }
  const hide = () => { timer.current = setTimeout(() => setOpen(null), 150) }
  const keep = () => { if (timer.current) clearTimeout(timer.current) }

  const isAllActive = !activeRegion && !activeCountry && !activeVirtual

  return (
    <div className="flex gap-2 flex-wrap mb-10">
      {/* All */}
      <div className="relative">
        <Link href={basePath} className={`${tabBase} ${isAllActive ? tabActive : tabInactive}`}>
          {allLabel}
        </Link>
      </div>

      {/* Region tabs */}
      {regions.map((region) => {
        const label = locale === 'ko' ? region.labelKo : region.labelEn
        const isActive =
          activeRegion === region.key ||
          region.countries.some((c) => c.code === activeCountry)
        const isOpen = open === region.key

        return (
          <div
            key={region.key}
            className="relative"
            onMouseEnter={() => show(region.key)}
            onMouseLeave={hide}
          >
            <Link
              href={`${basePath}?region=${region.key}`}
              className={`${tabBase} ${isActive ? tabActive : tabInactive}`}
            >
              {label}
            </Link>

            {isOpen && (
              <div
                className={dropdownBase}
                onMouseEnter={keep}
                onMouseLeave={hide}
              >
                {region.countries.map((c) => (
                  <Link
                    key={c.code}
                    href={`${basePath}?country=${c.code}`}
                    className={`${dropdownItem} ${activeCountry === c.code ? dropdownItemActive : dropdownItemInactive}`}
                  >
                    {locale === 'ko' ? c.nameKo : c.nameEn}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Virtual tab */}
      {virtualPrograms && virtualPrograms.length > 0 && (
        <div
          className="relative"
          onMouseEnter={() => show('__virtual__')}
          onMouseLeave={hide}
        >
          <Link
            href={`${basePath}?type=VIRTUAL_RIDE`}
            className={`${tabBase} ${activeVirtual ? tabActive : tabInactive}`}
          >
            {virtualLabel}
          </Link>

          {open === '__virtual__' && (
            <div
              className={dropdownBase}
              onMouseEnter={keep}
              onMouseLeave={hide}
            >
              {virtualPrograms.map((p) => (
                <Link
                  key={p.key}
                  href={`${basePath}?type=VIRTUAL_RIDE&program=${encodeURIComponent(p.key)}`}
                  className={`${dropdownItem} ${activeProgram === p.key ? dropdownItemActive : dropdownItemInactive}`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
