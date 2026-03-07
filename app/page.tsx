import dynamicImport from 'next/dynamic'
import { getGlobalStats, getCountryBreakdown } from '@/lib/stats'
import { RideType } from '@prisma/client'
import { getDictionary } from '@/lib/i18n'
import { db } from '@/lib/db'
import polyline from 'polyline-encoded'

export const dynamic = 'force-dynamic'

const GlobeScene = dynamicImport(() => import('@/components/three/GlobeScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="w-64 h-64 rounded-full border border-gray-800 animate-pulse" />
    </div>
  ),
})

export default async function HomePage() {
  const EXCLUDE = { excludeTypes: [RideType.VIRTUAL_RIDE, RideType.OTHER] }
  const [stats, countries, d, ridesWithPolyline] = await Promise.all([
    getGlobalStats(EXCLUDE),
    getCountryBreakdown(EXCLUDE),
    getDictionary(),
    db.ride.findMany({
      where: { polyline: { not: null }, type: { notIn: [RideType.VIRTUAL_RIDE, RideType.OTHER] } },
      select: { polyline: true, name: true, distanceM: true, elevationM: true, movingTimeSec: true, startedAt: true, country: true, slug: true, elevationProfile: true },
    }),
  ])

  // Decode polylines server-side → lightweight coordinate arrays + metadata for the client
  const rideLines: { coords: [number, number][]; name: string; distanceKm: number; elevationM: number; movingTimeSec: number; startedAt: string; country: string | null; url: string; elevationProfile?: { distance: number; altitude: number }[] }[] = []
  for (const r of ridesWithPolyline) {
    if (!r.polyline) continue
    try {
      const coords = polyline.decode(r.polyline) as [number, number][]
      if (coords.length >= 2) {
        const countrySlug = r.country?.toLowerCase().replace(/\s+/g, '-') || 'unknown'
        rideLines.push({
          coords,
          name: r.name,
          distanceKm: Math.round(r.distanceM / 1000),
          elevationM: Math.round(r.elevationM),
          movingTimeSec: r.movingTimeSec,
          startedAt: r.startedAt.toISOString(),
          country: r.country,
          url: `/rides/${countrySlug}/${r.slug}`,
          elevationProfile: (r.elevationProfile as { distance: number; altitude: number }[] | null) ?? undefined,
        })
      }
    } catch { /* skip malformed */ }
  }

  const statItems = [
    { value: stats.totalDistanceKm.toLocaleString(), label: d.home.stats.km, unit: d.home.stats.units.km },
    { value: stats.totalElevationM.toLocaleString(), label: d.home.stats.elevation, unit: d.home.stats.units.elevation },
    { value: stats.totalMovingHours.toLocaleString(), label: d.home.stats.hours, unit: d.home.stats.units.hours },
    { value: stats.totalRides.toLocaleString(), label: d.home.stats.rides, unit: d.home.stats.units.rides, hideMobile: true },
    { value: String(stats.countriesVisited), label: d.home.stats.countries, unit: d.home.stats.units.countries, hideMobile: true },
  ]

  return (
    <GlobeScene
      visitedCountries={countries}
      rideLines={rideLines}
      label={d.home.label}
      tagline={d.home.tagline}
      subtitle={`${stats.totalDistanceKm.toLocaleString()}km · ${stats.countriesVisited}개국`}
      statItems={statItems}
      tooltipLabels={{ rides: d.map.rides, km: d.map.km }}
    />
  )
}
