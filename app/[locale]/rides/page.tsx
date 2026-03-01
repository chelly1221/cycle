import { db } from '@/lib/db'
import { RideType } from '@prisma/client'
import RideCard from '@/components/rides/RideCard'
import RegionFilter, { type VirtualProgram } from '@/components/rides/RegionFilter'
import { getDictionary, type Locale } from '@/lib/i18n'
import { REGIONS, getRegionForCode, getRegionByKey, type RegionData } from '@/lib/regions'
import { getCountryName } from '@/lib/countryNames'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale }
}): Promise<Metadata> {
  const d = await getDictionary(params.locale)
  return { title: d.rides.title }
}

interface SearchParams {
  country?: string  // ISO code e.g. "KR"
  region?: string   // region key e.g. "east-asia"
  type?: string     // "VIRTUAL_RIDE"
  program?: string  // virtual program name e.g. "Zwift"
}

function extractProgram(name: string): string {
  const idx = name.indexOf(' - ')
  return idx > 0 ? name.slice(0, idx).trim() : name.trim()
}

export default async function RidesPage({
  params,
  searchParams,
}: {
  params: { locale: Locale }
  searchParams: SearchParams
}) {
  const { locale } = params
  const d = await getDictionary(locale)
  const isVirtual = searchParams.type === 'VIRTUAL_RIDE'

  // Build where clause
  const where: Record<string, unknown> = {}
  if (isVirtual) {
    where.type = RideType.VIRTUAL_RIDE
    if (searchParams.program) {
      where.name = { startsWith: searchParams.program }
    }
  } else {
    where.type = { notIn: [RideType.VIRTUAL_RIDE, RideType.OTHER] }
    if (searchParams.region) {
      const region = getRegionByKey(searchParams.region)
      if (region) where.countryCode = { in: region.codes }
    } else if (searchParams.country) {
      where.countryCode = searchParams.country
    }
  }

  const [rides, countryGroups, virtualRideNames] = await Promise.all([
    db.ride.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        country: true,
        countryCode: true,
        distanceM: true,
        elevationM: true,
        movingTimeSec: true,
        startedAt: true,
        type: true,
      },
    }),
    db.ride.groupBy({
      by: ['country', 'countryCode'],
      where: { country: { not: null }, countryCode: { not: null }, type: { notIn: [RideType.VIRTUAL_RIDE, RideType.OTHER] } },
    }),
    db.ride.findMany({
      where: { type: RideType.VIRTUAL_RIDE },
      select: { name: true },
    }),
  ])

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

  // Build virtual programs list
  const programSet = new Set<string>()
  for (const { name } of virtualRideNames) {
    programSet.add(extractProgram(name))
  }
  const virtualPrograms: VirtualProgram[] = Array.from(programSet)
    .sort()
    .map((p) => ({ key: p, label: p }))

  const basePath = `/${locale}/rides`

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
        virtualLabel={locale === 'ko' ? '가상' : 'Virtual'}
        locale={locale}
        basePath={basePath}
        allLabel={d.rides.allRegions}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {rides.map((ride) => (
          <RideCard key={ride.id} ride={ride} locale={locale} units={d.rides.units} />
        ))}
      </div>

      {rides.length === 0 && (
        <p className="text-gray-600 text-center py-20">{d.rides.empty}</p>
      )}
    </div>
  )
}
