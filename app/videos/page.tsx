import { db } from '@/lib/db'
import { MediaType } from '@prisma/client'
import { getDictionary } from '@/lib/i18n'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDictionary()
  return { title: d.videos.title }
}

function extractVideoId(url: string): string {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /[?&]v=([^?&]+)/,
    /^[a-zA-Z0-9_-]{11}$/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return url
}

export default async function VideosPage() {
  const d = await getDictionary()

  const videos = await db.media.findMany({
    where: { type: MediaType.YOUTUBE },
    include: {
      ride: {
        select: {
          name: true,
          slug: true,
          country: true,
          countryCode: true,
          startedAt: true,
          distanceM: true,
          elevationM: true,
        },
      },
    },
    orderBy: { ride: { startedAt: 'desc' } },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">{d.videos.title}</h1>
      <p className="text-gray-500 mb-8">
        {d.videos.count.replace('{n}', String(videos.length))}
      </p>

      {videos.length === 0 && (
        <p className="text-gray-600 text-center py-20">{d.videos.empty}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((v) => {
          const videoId = extractVideoId(v.url)
          const country = v.ride.country?.toLowerCase().replace(/\s+/g, '-') ?? ''
          const dateStr = v.ride.startedAt.toISOString().split('T')[0].split('-')
          const date = `${dateStr[0]}.${dateStr[1]}.${dateStr[2]}`

          return (
            <Link
              key={v.id}
              href={`/rides/${country}/${v.ride.slug}`}
              className="group block"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-900">
                <Image
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt={v.title ?? v.ride.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-red-600/80 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <polygon points="6,3 20,12 6,21" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-sm font-medium text-white group-hover:text-strava transition-colors line-clamp-2">
                  {v.title ?? v.ride.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {v.ride.country} · {date} · {(v.ride.distanceM / 1000).toFixed(0)}km
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
