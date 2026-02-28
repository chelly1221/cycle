import dynamicImport from 'next/dynamic'
import { getGlobalStats, getCountryBreakdown } from '@/lib/stats'
import { RideType } from '@prisma/client'
import { getDictionary, type Locale } from '@/lib/i18n'
import { db } from '@/lib/db'
import polyline from 'polyline-encoded'
import type { MediaPin } from '@/components/three/MediaPinPanel'

export const dynamic = 'force-dynamic'

const GlobeScene = dynamicImport(() => import('@/components/three/GlobeScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="w-64 h-64 rounded-full border border-gray-800 animate-pulse" />
    </div>
  ),
})

export default async function HomePage({ params }: { params: { locale: Locale } }) {
  const EXCLUDE = { excludeTypes: [RideType.VIRTUAL_RIDE] }
  const [stats, countries, d, ridesWithPolyline, ridesWithMedia] = await Promise.all([
    getGlobalStats(EXCLUDE),
    getCountryBreakdown(EXCLUDE),
    getDictionary(params.locale),
    db.ride.findMany({
      where: { polyline: { not: null }, type: { not: RideType.VIRTUAL_RIDE } },
      select: { polyline: true },
    }),
    db.ride.findMany({
      where: {
        startLat: { not: null },
        startLng: { not: null },
        media: { some: {} },
        type: { not: RideType.VIRTUAL_RIDE },
      },
      select: {
        id: true, name: true, slug: true, country: true, countryCode: true,
        distanceM: true, elevationM: true, movingTimeSec: true,
        startLat: true, startLng: true,
        media: { select: { id: true, type: true, url: true, title: true }, orderBy: { sortOrder: 'asc' } },
      },
    }),
  ])

  // Decode polylines server-side → lightweight coordinate arrays for the client
  const rideLines: [number, number][][] = []
  for (const r of ridesWithPolyline) {
    if (!r.polyline) continue
    try {
      const coords = polyline.decode(r.polyline) as [number, number][]
      if (coords.length >= 2) rideLines.push(coords)
    } catch { /* skip malformed */ }
  }

  // Transform media rides into MediaPin format for the globe
  const mediaPins: MediaPin[] = ridesWithMedia.map(r => ({
    rideId: r.id,
    rideName: r.name,
    rideSlug: r.slug,
    country: r.country,
    countryCode: r.countryCode,
    distanceKm: Math.round(r.distanceM / 100) / 10,
    elevationM: r.elevationM,
    movingTimeSec: r.movingTimeSec,
    lat: r.startLat!,
    lng: r.startLng!,
    media: r.media.map(m => ({ id: m.id, type: m.type, url: m.url, title: m.title })),
  }))

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
      mediaPins={mediaPins}
      mediaPanelLabels={d.globe.mediaPanel}
      label={d.home.label}
      tagline={d.home.tagline}
      subtitle={`${stats.totalDistanceKm.toLocaleString()}km · ${stats.countriesVisited}${params.locale === 'ko' ? '개국' : ' countries'}`}
      statItems={statItems}
      locale={params.locale}
      tooltipLabels={{ rides: d.map.rides, km: d.map.km }}
    />
  )
}
