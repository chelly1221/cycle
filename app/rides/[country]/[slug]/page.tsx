import { notFound } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { db } from '@/lib/db'
import YouTubeEmbed from '@/components/embeds/YouTubeEmbed'
import InstagramEmbed from '@/components/embeds/InstagramEmbed'
import StravaPhotos from '@/components/embeds/StravaPhotos'
import ReviewEditor from '@/components/rides/ReviewEditor'
import { getDictionary } from '@/lib/i18n'
import { isAuthedServer } from '@/lib/auth'
import type { Metadata } from 'next'
import { MediaType } from '@prisma/client'

export const dynamic = 'force-dynamic'

const RideMapHero = dynamicImport(() => import('@/components/map/RideMapHero'), {
  ssr: false,
  loading: () => <div className="w-full h-[70vh] bg-gray-950 animate-pulse" />,
})

interface Params {
  country: string
  slug: string
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ride = await db.ride.findUnique({
    where: { slug: params.slug },
    select: { name: true, country: true, description: true },
  })
  if (!ride) return {}
  const ogUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cycle.3chan.kr'}/api/rides/${params.slug}/og`
  return {
    title: ride.name,
    description: ride.description ?? `${ride.name} — ${ride.country}`,
    openGraph: {
      title: ride.name,
      description: ride.description ?? `${ride.name} — ${ride.country}`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ride.name,
      description: ride.description ?? `${ride.name} — ${ride.country}`,
      images: [ogUrl],
    },
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default async function RidePage({ params }: { params: Params }) {
  const [ride, d, loggedIn] = await Promise.all([
    db.ride.findUnique({
      where: { slug: params.slug },
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    }),
    getDictionary(),
    Promise.resolve(isAuthedServer()),
  ])

  if (!ride) notFound()

  const youtube = ride.media.find((m) => m.type === MediaType.YOUTUBE)
  const instagrams = ride.media.filter((m) => m.type === MediaType.INSTAGRAM)
  const stravaPhotos = ride.media.filter((m) => m.type === MediaType.STRAVA_PHOTO)
  const elevationData = ride.elevationProfile
    ? (ride.elevationProfile as { distance: number; altitude: number }[])
    : []

  const avgSpeedKmh = ride.movingTimeSec > 0
    ? ride.distanceM / 1000 / (ride.movingTimeSec / 3600)
    : 0

  const statItems = [
    { v: `${(ride.distanceM / 1000).toFixed(1)}`, u: 'km', l: d.ride.distance },
    { v: `${Math.round(ride.elevationM).toLocaleString()}`, u: 'm', l: d.ride.elevation },
    { v: formatDuration(ride.movingTimeSec), u: '', l: d.ride.movingTime },
    { v: `${avgSpeedKmh.toFixed(1)}`, u: 'km/h', l: d.ride.avgSpeed },
  ]

  const dateStr = new Date(ride.startedAt).toLocaleDateString('ko-KR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <article>
      {/* Map hero with overlaid info + elevation chart fused below */}
      {ride.polyline && (
        <RideMapHero
          polyline={ride.polyline}
          elevationData={elevationData}
          name={ride.name}
          country={ride.country ?? ''}
          date={dateStr}
          stats={statItems}
          elevationLabel={d.charts.elevation.label}
          kmSuffix={d.charts.elevation.kmSuffix}
        />
      )}

      {/* Fallback if no polyline */}
      {!ride.polyline && (
        <div className="max-w-5xl mx-auto px-4 pt-12">
          <p className="text-strava text-xs font-mono uppercase tracking-widest mb-2">
            {ride.country} · {dateStr}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 font-ride-title">{ride.name}</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {statItems.map(({ v, u, l }) => (
              <div key={l} className="bg-gray-950 rounded-lg p-4">
                <p className="text-2xl font-mono font-bold text-white">
                  {v}<span className="text-sm text-gray-500 ml-1">{u}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* YouTube embed */}
        {youtube && (
          <YouTubeEmbed url={youtube.url} title={ride.name} fallbackTitle={d.embeds.rideFilm} />
        )}

        {/* Instagram embeds */}
        {instagrams.length > 0 && (
          <div className="space-y-6">
            {instagrams.map((m) => (
              <InstagramEmbed key={m.id} url={m.url} fallbackLabel={d.embeds.viewOnInstagram} />
            ))}
          </div>
        )}

        {/* Strava photos */}
        {stravaPhotos.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">{d.embeds.photos}</h2>
            <StravaPhotos
              photos={stravaPhotos.map((m) => ({
                id: m.id,
                url: m.url,
                thumbnailUrl: m.thumbnailUrl,
                title: m.title,
              }))}
              rideName={ride.name}
            />
          </div>
        )}

        {/* Story / Review editor */}
        <ReviewEditor
          rideSlug={params.slug}
          initialStory={ride.story}
          isLoggedIn={loggedIn}
          label={d.ride.theRide}
        />

        {/* Description fallback (only when no story and not logged in) */}
        {ride.description && !ride.story && !loggedIn && (
          <p className="text-gray-400 leading-relaxed">{ride.description}</p>
        )}

        {/* GPX download */}
        {ride.polyline && (
          <div className="pt-4 border-t border-gray-800/50">
            <a
              href={`/api/rides/${params.slug}/gpx`}
              download
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              GPX 다운로드
            </a>
          </div>
        )}
      </div>
    </article>
  )
}
