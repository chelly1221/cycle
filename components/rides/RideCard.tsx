import Link from 'next/link'
import type { Ride } from '@prisma/client'
import { getCountryName } from '@/lib/countryNames'

type RideCardProps = Pick<
  Ride,
  | 'name'
  | 'slug'
  | 'country'
  | 'countryCode'
  | 'distanceM'
  | 'elevationM'
  | 'movingTimeSec'
  | 'startedAt'
  | 'type'
>

interface Props {
  ride: RideCardProps
  locale?: string
  units?: { km: string; elev: string; moving: string; unknown: string }
}

const DEFAULT_UNITS = { km: 'km', elev: 'm elev', moving: 'moving', unknown: 'Unknown' }

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function RideCard({ ride, locale = 'en', units = DEFAULT_UNITS }: Props) {
  const countrySlug = ride.country?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown'

  return (
    <Link
      href={`/${locale}/rides/${countrySlug}/${ride.slug}`}
      className="group block bg-road-gray border border-gray-800 rounded-lg overflow-hidden hover:border-strava transition-colors"
    >
      <div className="p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          {getCountryName(ride.countryCode, locale, ride.country ?? units.unknown)} ·{' '}
          {new Date(ride.startedAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
        <h3 className="text-white font-semibold text-lg leading-snug group-hover:text-strava transition-colors mb-4">
          {ride.name}
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-mono font-bold text-white">
              {(ride.distanceM / 1000).toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">{units.km}</p>
          </div>
          <div>
            <p className="text-xl font-mono font-bold text-white">
              {Math.round(ride.elevationM).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{units.elev}</p>
          </div>
          <div>
            <p className="text-xl font-mono font-bold text-white">
              {formatDuration(ride.movingTimeSec)}
            </p>
            <p className="text-xs text-gray-500">{units.moving}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}
