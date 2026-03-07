import { db } from '@/lib/db'
import { MediaType } from '@prisma/client'
import { getDictionary } from '@/lib/i18n'
import type { Metadata } from 'next'
import PhotoGallery from '@/components/photos/PhotoGallery'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 40

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDictionary()
  return { title: d.photos.title }
}

export default async function PhotosPage() {
  const d = await getDictionary()

  const [photos, totalCount] = await Promise.all([
    db.media.findMany({
      where: { type: MediaType.STRAVA_PHOTO },
      include: {
        ride: {
          select: {
            name: true,
            slug: true,
            country: true,
            startedAt: true,
          },
        },
      },
      orderBy: [{ ride: { startedAt: 'desc' } }, { sortOrder: 'asc' }],
      take: PAGE_SIZE + 1,
    }),
    db.media.count({ where: { type: MediaType.STRAVA_PHOTO } }),
  ])

  const hasMore = photos.length > PAGE_SIZE
  const items = hasMore ? photos.slice(0, PAGE_SIZE) : photos
  const nextCursor = hasMore ? items[items.length - 1].id : null

  const photoData = items.map((p) => ({
    id: p.id,
    url: p.url,
    thumbnailUrl: p.thumbnailUrl,
    title: p.title,
    rideName: p.ride.name,
    rideSlug: p.ride.slug,
    country: p.ride.country,
    countrySlug: p.ride.country?.toLowerCase().replace(/\s+/g, '-') ?? '',
    date: p.ride.startedAt.toISOString().split('T')[0],
  }))

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">{d.photos.title}</h1>
      <p className="text-gray-500 mb-8">
        {d.photos.count.replace('{n}', String(totalCount))}
      </p>

      {totalCount === 0 && (
        <p className="text-gray-600 text-center py-20">{d.photos.empty}</p>
      )}

      <PhotoGallery
        initialPhotos={photoData}
        initialCursor={nextCursor}
        viewRideLabel={d.photos.viewRide}
      />
    </div>
  )
}
