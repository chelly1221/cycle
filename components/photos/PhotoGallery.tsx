'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Photo {
  id: string
  url: string
  thumbnailUrl: string | null
  title: string | null
  rideName: string
  rideSlug: string
  country: string | null
  countrySlug: string
  date: string
}

interface Props {
  initialPhotos: Photo[]
  initialCursor: string | null
  viewRideLabel: string
}

export default function PhotoGallery({ initialPhotos, initialCursor, viewRideLabel }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/photos?cursor=${cursor}`)
      const data = await res.json()
      setPhotos((prev) => [...prev, ...data.items])
      setCursor(data.nextCursor)
    } finally {
      setLoading(false)
    }
  }, [cursor, loading])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '600px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  if (photos.length === 0) return null

  const current = lightbox !== null ? photos[lightbox] : null

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setLightbox(i)}
            className="block w-full overflow-hidden rounded-lg bg-gray-900 group cursor-pointer break-inside-avoid"
          >
            <Image
              src={photo.thumbnailUrl ?? photo.url}
              alt={photo.title ?? photo.rideName}
              width={600}
              height={400}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 border-2 border-gray-700 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setLightbox(null)}
        >
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox((lightbox - 1 + photos.length) % photos.length)
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl z-10 p-2"
              >
                &#8249;
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox((lightbox + 1) % photos.length)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl z-10 p-2"
              >
                &#8250;
              </button>
            </>
          )}

          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl z-10 p-2"
          >
            &#10005;
          </button>

          <div
            className="relative max-w-[90vw] max-h-[80vh] w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={current.url}
              alt={current.title ?? current.rideName}
              fill
              sizes="90vw"
              className="object-contain"
              priority
            />
          </div>

          <div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-white font-medium text-sm">{current.rideName}</p>
                <p className="text-gray-400 text-xs">
                  {current.country} · {current.date}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-500 text-xs">
                  {lightbox + 1} / {photos.length}
                </span>
                <Link
                  href={`/rides/${current.countrySlug}/${current.rideSlug}`}
                  className="text-xs text-strava hover:text-white transition-colors"
                >
                  {viewRideLabel} &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
