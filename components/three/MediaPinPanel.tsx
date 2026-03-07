'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

export interface MediaPin {
  rideId: string
  rideName: string
  rideSlug: string
  country: string | null
  countryCode: string | null
  distanceKm: number
  elevationM: number
  movingTimeSec: number
  lat: number
  lng: number
  media: { id: string; type: 'YOUTUBE' | 'INSTAGRAM' | 'STRAVA_ACTIVITY'; url: string; title: string | null }[]
}

export interface MediaPanelLabels {
  distance: string
  elevation: string
  movingTime: string
  viewRide: string
  close: string
}

interface Props {
  pin: MediaPin
  onClose: () => void
  labels: MediaPanelLabels
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&]+)/)
  return m ? m[1] : null
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function MediaPinPanel({ pin, onClose, labels }: Props) {
  const [visible, setVisible] = useState(false)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  const youtubeMedia = pin.media.filter(m => m.type === 'YOUTUBE')
  const instagramMedia = pin.media.filter(m => m.type === 'INSTAGRAM')

  const countrySlug = pin.country?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown'

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-end"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        className={`relative w-full md:w-[420px] md:mr-6 h-full md:h-auto md:max-h-[80vh]
                     bg-white/10 backdrop-blur-xl border border-white/20 md:rounded-2xl
                     overflow-y-auto transition-all duration-200 ease-out
                     ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between p-4 pb-2 bg-white/5 backdrop-blur-sm md:rounded-t-2xl">
          <div className="min-w-0 pr-3">
            <h3 className="text-white font-semibold text-lg leading-tight truncate">
              {pin.rideName}
            </h3>
            {pin.country && (
              <p className="text-gray-400 text-sm mt-0.5">{pin.country}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full
                       bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            aria-label={labels.close}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <div className="p-4 pt-2 space-y-4">
          {/* YouTube thumbnails */}
          {youtubeMedia.map(m => {
            const ytId = extractYouTubeId(m.url)
            if (!ytId) return null

            if (playingVideoId === ytId) {
              return (
                <div key={m.id} className="relative w-full aspect-video rounded-lg overflow-hidden">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              )
            }

            return (
              <button
                key={m.id}
                onClick={() => setPlayingVideoId(ytId)}
                className="relative w-full aspect-video rounded-lg overflow-hidden group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                  alt={m.title || pin.rideName}
                  className="w-full h-full object-cover"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg width="20" height="24" viewBox="0 0 20 24" fill="#111">
                      <path d="M0 0l20 12-20 12z" />
                    </svg>
                  </div>
                </div>
                {m.title && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white text-xs truncate">{m.title}</p>
                  </div>
                )}
              </button>
            )
          })}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 py-2">
            <div className="text-center">
              <p className="text-white font-mono text-lg font-semibold">{pin.distanceKm.toFixed(1)}<span className="text-xs text-gray-400 ml-0.5">km</span></p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">{labels.distance}</p>
            </div>
            <div className="text-center">
              <p className="text-white font-mono text-lg font-semibold">{pin.elevationM.toFixed(0)}<span className="text-xs text-gray-400 ml-0.5">m</span></p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">{labels.elevation}</p>
            </div>
            <div className="text-center">
              <p className="text-white font-mono text-lg font-semibold">{formatTime(pin.movingTimeSec)}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">{labels.movingTime}</p>
            </div>
          </div>

          {/* Instagram links */}
          {instagramMedia.length > 0 && (
            <div className="space-y-2">
              {instagramMedia.map(m => (
                <a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-pink-400 shrink-0">
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                  <span className="text-white/80 text-sm truncate">{m.title || 'Instagram'}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500 shrink-0 ml-auto">
                    <path d="M3.5 1.5h7v7M10.5 1.5l-9 9" />
                  </svg>
                </a>
              ))}
            </div>
          )}

          {/* View full ride link */}
          <Link
            href={`/rides/${countrySlug}/${pin.rideSlug}`}
            className="block w-full text-center py-2.5 rounded-lg bg-strava/90 hover:bg-strava text-white text-sm font-medium transition-colors"
          >
            {labels.viewRide}
          </Link>
        </div>
      </div>
    </div>
  )
}
