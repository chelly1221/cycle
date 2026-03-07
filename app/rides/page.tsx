import { db } from '@/lib/db'
import { RideType } from '@prisma/client'
import RideTable from '@/components/rides/RideTable'
import RegionFilter, { type VirtualProgram } from '@/components/rides/RegionFilter'
import { getDictionary } from '@/lib/i18n'
import { REGIONS, getRegionForCode, getRegionByKey, type RegionData } from '@/lib/regions'
import { getCountryName } from '@/lib/countryNames'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDictionary()
  return { title: d.rides.title }
}

interface SearchParams {
  country?: string
  region?: string
  type?: string
  program?: string
}

// ─── Virtual ride platform detection ─────────────────────────────────────────

interface VirtualPlatform {
  key: string
  label: string
  match: (name: string) => boolean
}

const ZWIFT_WORLDS = [
  'Watopia', 'London', 'Innsbruck', 'Richmond', 'Yorkshire',
  'France', 'Paris', 'New York', 'Makuri Islands', 'Scotland',
]
const zwiftWorldRe = new RegExp(
  `^(${ZWIFT_WORLDS.join('|')})(\\s*[|:]|$)`, 'i'
)

const PLATFORMS: VirtualPlatform[] = [
  {
    key: 'zwift',
    label: 'Zwift',
    match: (n) =>
      /^Zwift\b/i.test(n) ||
      /즈위프트/i.test(n) ||
      zwiftWorldRe.test(n) ||
      /Meetup\s*-/i.test(n) ||
      /\bin (Watopia|London|Innsbruck|Richmond|Yorkshire|France|Paris|New York|Scotland)\b/i.test(n) ||
      /\bvEveresting\b/i.test(n) ||
      /\b(KZR|EVO CC|3R)\b/.test(n) ||
      /Tour des Stations/i.test(n),
  },
  {
    key: 'trainer',
    label: '실내 트레이너',
    match: (n) =>
      /헬스장/.test(n) ||
      /고정롤러/.test(n) ||
      /실내/.test(n) ||
      /스피닝/.test(n) ||
      /^\s*FTP\s*(Ramp\s*)?Test/i.test(n),
  },
]

function detectPlatform(name: string): string {
  for (const p of PLATFORMS) {
    if (p.match(name)) return p.key
  }
  return 'other'
}

function getPlatformNames(key: string): ((name: string) => boolean) | null {
  const platform = PLATFORMS.find((p) => p.key === key)
  if (platform) return platform.match
  if (key === 'other') {
    return (name: string) => PLATFORMS.every((p) => !p.match(name))
  }
  return null
}

export default async function RidesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const d = await getDictionary()
  const isVirtual = searchParams.type === 'VIRTUAL_RIDE'

  // Build where clause
  const where: Record<string, unknown> = {}
  if (isVirtual) {
    where.type = RideType.VIRTUAL_RIDE
  } else {
    where.type = { notIn: [RideType.VIRTUAL_RIDE, RideType.OTHER] }
    if (searchParams.region) {
      const region = getRegionByKey(searchParams.region)
      if (region) where.countryCode = { in: region.codes }
    } else if (searchParams.country) {
      where.countryCode = searchParams.country
    }
  }

  const [allVirtualRides, countryGroups] = await Promise.all([
    isVirtual
      ? db.ride.findMany({
          where: { type: RideType.VIRTUAL_RIDE },
          orderBy: { startedAt: 'desc' },
          select: {
            id: true, name: true, slug: true, country: true,
            countryCode: true, distanceM: true, elevationM: true,
            movingTimeSec: true, startedAt: true, type: true,
            averageSpeed: true, averageWatts: true,
          },
        })
      : Promise.resolve([]),
    db.ride.groupBy({
      by: ['country', 'countryCode'],
      where: { country: { not: null }, countryCode: { not: null }, type: { notIn: [RideType.VIRTUAL_RIDE, RideType.OTHER] } },
    }),
  ])

  // For virtual rides, filter by platform client-side
  let rides
  if (isVirtual) {
    const platformFilter = searchParams.program
      ? getPlatformNames(searchParams.program)
      : null
    rides = platformFilter
      ? allVirtualRides.filter((r) => platformFilter(r.name))
      : allVirtualRides
  } else {
    rides = await db.ride.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      select: {
        id: true, name: true, slug: true, country: true,
        countryCode: true, distanceM: true, elevationM: true,
        movingTimeSec: true, startedAt: true, type: true,
        averageSpeed: true, averageWatts: true,
      },
    })
  }

  // Build region data
  const regionMap = new Map<string, RegionData>()
  for (const { country, countryCode } of countryGroups) {
    if (!country || !countryCode) continue
    const region = getRegionForCode(countryCode)
    if (!region) continue
    if (!regionMap.has(region.key)) {
      regionMap.set(region.key, { key: region.key, labelEn: region.labelEn, labelKo: region.labelKo, countries: [] })
    }
    regionMap.get(region.key)!.countries.push({
      code: countryCode,
      nameEn: country,
      nameKo: getCountryName(countryCode, 'ko', country),
    })
  }
  const regionData: RegionData[] = REGIONS
    .filter((r) => regionMap.has(r.key))
    .map((r) => {
      const rd = regionMap.get(r.key)!
      rd.countries.sort((a, b) => r.codes.indexOf(a.code) - r.codes.indexOf(b.code))
      return rd
    })

  // Build virtual platform list with counts
  let virtualPrograms: VirtualProgram[] = []
  const hasVirtual = await db.ride.count({ where: { type: RideType.VIRTUAL_RIDE } })
  if (isVirtual && allVirtualRides.length > 0) {
    const platformCounts = new Map<string, number>()
    for (const r of allVirtualRides) {
      const pk = detectPlatform(r.name)
      platformCounts.set(pk, (platformCounts.get(pk) ?? 0) + 1)
    }
    virtualPrograms = PLATFORMS
      .filter((p) => platformCounts.has(p.key))
      .map((p) => ({ key: p.key, label: `${p.label} (${platformCounts.get(p.key)})` }))
    const otherCount = platformCounts.get('other') ?? 0
    if (otherCount > 0) {
      virtualPrograms.push({ key: 'other', label: `기타 (${otherCount})` })
    }
  } else if (hasVirtual > 0) {
    // Placeholder so the virtual tab renders
    virtualPrograms = [{ key: '_placeholder', label: '' }]
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">{d.rides.title}</h1>
      <p className="text-gray-500 mb-8">
        {d.rides.count.replace('{n}', String(rides.length))}
      </p>

      <RegionFilter
        regions={regionData}
        activeRegion={searchParams.region}
        activeCountry={searchParams.country}
        activeVirtual={isVirtual}
        activeProgram={searchParams.program}
        virtualPrograms={virtualPrograms}
        virtualLabel="가상"
        basePath="/rides"
        allLabel={d.rides.allRegions}
      />

      {rides.length > 0 ? (
        <RideTable rides={rides} />
      ) : (
        <p className="text-gray-600 text-center py-20">{d.rides.empty}</p>
      )}
    </div>
  )
}
