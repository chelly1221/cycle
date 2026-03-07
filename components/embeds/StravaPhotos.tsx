'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Photo {
  id: string
  url: string
  thumbnailUrl: string | null
  title: string | null
}

interface Props {
  photos: Photo[]
  rideName: string
}

export default function StravaPhotos({ photos, rideName }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null)

  if (photos.length === 0) return null

  return (
    <>
      <div className={`grid gap-2 ${photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setLightbox(i)}
            className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-900 group cursor-pointer"
          >
            <Image
              src={photo.thumbnailUrl ?? photo.url}
              alt={photo.title ?? `${rideName} #${i + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          {/* Nav buttons */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox((lightbox - 1 + photos.length) % photos.length)
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl z-10 p-2"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox((lightbox + 1) % photos.length)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl z-10 p-2"
              >
                ›
              </button>
            </>
          )}

          {/* Close button */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl z-10 p-2"
          >
            ✕
          </button>

          {/* Image */}
          <div className="relative max-w-[90vw] max-h-[85vh] w-full h-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={photos[lightbox].url}
              alt={photos[lightbox].title ?? `${rideName} #${lightbox + 1}`}
              fill
              sizes="90vw"
              className="object-contain"
              priority
            />
          </div>

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightbox + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  )
}
