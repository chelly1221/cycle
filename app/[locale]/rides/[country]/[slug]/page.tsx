import { notFound } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { db } from '@/lib/db'
import YouTubeEmbed from '@/components/embeds/YouTubeEmbed'
import InstagramEmbed from '@/components/embeds/InstagramEmbed'
import ElevationChart from '@/components/charts/ElevationChart'
import { getDictionary, type Locale } from '@/lib/i18n'
import type { Metadata } from 'next'
import { MediaType } from '@prisma/client'

export const dynamic = 'force-dynamic'

const RideMap = dynamicImport(() => import('@/components/map/RideMap'), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-950 animate-pulse rounded-lg" />,
})

interface Params {
  locale: Locale
  country: string
  slug: string
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ride = await db.ride.findUnique({
    where: { slug: params.slug },
    select: { name: true, country: true, description: true },
  })
  if (!ride) return {}
  return {
    title: ride.name,
    description: ride.description ?? `${ride.name} — ${ride.country}`,
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default async function RidePage({ params }: { params: Params }) {
  const [ride, d] = await Promise.all([
    db.ride.findUnique({
      where: { slug: params.slug },
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    }),
    getDictionary(params.locale),
  ])

  if (!ride) notFound()

  const youtube = ride.media.find((m) => m.type === MediaType.YOUTUBE)
  const instagrams = ride.media.filter((m) => m.type === MediaType.INSTAGRAM)
  const elevationData = ride.elevationProfile
    ? (ride.elevationProfile as { distance: number; altitude: number }[])
    : []

  const avgSpeedKmh = ride.distanceM / 1000 / (ride.movingTimeSec / 3600)

  const statItems = [
    { v: `${(ride.distanceM / 1000).toFixed(1)} km`, l: d.ride.distance },
    { v: `${Math.round(ride.elevationM).toLocaleString()} m`, l: d.ride.elevation },
    { v: formatDuration(ride.movingTimeSec), l: d.ride.movingTime },
    { v: `${avgSpeedKmh.toFixed(1)} km/h`, l: d.ride.avgSpeed },
  ]

  return (
    <article className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-strava text-xs font-mono uppercase tracking-widest mb-2">
          {ride.country} ·{' '}
          {new Date(ride.startedAt).toLocaleDateString(
            'ko-KR',
            { day: 'numeric', month: 'long', year: 'numeric' }
          )}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">{ride.name}</h1>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statItems.map(({ v, l }) => (
            <div key={l} className="bg-gray-950 rounded-lg p-4">
              <p className="text-2xl font-mono font-bold text-white">{v}</p>
              <p className="text-xs text-gray-500 mt-1">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* YouTube embed */}
      {youtube && (
        <div className="mb-10">
          <YouTubeEmbed url={youtube.url} title={ride.name} fallbackTitle={d.embeds.rideFilm} />
        </div>
      )}

      {/* Instagram embeds */}
      {instagrams.length > 0 && (
        <div className="mb-10 space-y-6">
          {instagrams.map((m) => (
            <InstagramEmbed key={m.id} url={m.url} fallbackLabel={d.embeds.viewOnInstagram} />
          ))}
        </div>
      )}

      {/* Route map */}
      {ride.polyline && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">{d.ride.route}</h2>
          <RideMap polyline={ride.polyline} />
        </div>
      )}

      {/* Elevation profile */}
      {elevationData.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">{d.ride.elevationProfile}</h2>
          <div className="bg-gray-950 rounded-lg p-4">
            <ElevationChart
              data={elevationData}
              labels={{ elevation: d.charts.elevation.label, kmSuffix: d.charts.elevation.kmSuffix }}
            />
          </div>
        </div>
      )}

      {/* Story */}
      {ride.story && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">{d.ride.theRide}</h2>
          <p className="text-gray-400 leading-relaxed whitespace-pre-line">{ride.story}</p>
        </div>
      )}

      {/* Description */}
      {ride.description && !ride.story && (
        <div className="mb-10">
          <p className="text-gray-400 leading-relaxed">{ride.description}</p>
        </div>
      )}
    </article>
  )
}
