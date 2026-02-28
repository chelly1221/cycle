import {
  getGlobalStats,
  getCountryBreakdown,
  getYearlyStats,
  getTopClimbs,
} from '@/lib/stats'
import YearlyChart from '@/components/charts/YearlyChart'
import { getDictionary, type Locale } from '@/lib/i18n'
import { getCountryName } from '@/lib/countryNames'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale }
}): Promise<Metadata> {
  const d = await getDictionary(params.locale)
  return { title: d.dashboard.title }
}

function countryToSlug(country: string | null): string {
  return country?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown'
}

export default async function DashboardPage({
  params,
}: {
  params: { locale: Locale }
}) {
  const { locale } = params
  const [stats, countries, yearlyStats, topClimbs, d] = await Promise.all([
    getGlobalStats(),
    getCountryBreakdown(),
    getYearlyStats(),
    getTopClimbs(10),
    getDictionary(locale),
  ])

  const statItems = [
    { v: stats.totalDistanceKm.toLocaleString(), l: d.dashboard.stats.km },
    { v: stats.totalElevationM.toLocaleString(), l: d.dashboard.stats.elevation },
    { v: stats.totalMovingHours.toLocaleString(), l: d.dashboard.stats.hours },
    { v: stats.totalRides, l: d.dashboard.stats.rides },
    { v: stats.countriesVisited, l: d.dashboard.stats.countries },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">{d.dashboard.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{d.dashboard.subtitle}</p>
      </div>

      {/* Global totals */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        {statItems.map(({ v, l }) => (
          <div key={l} className="bg-gray-950 border border-gray-800 rounded-lg p-5 text-center">
            <p className="text-3xl font-mono font-bold text-strava">{v}</p>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">{l}</p>
          </div>
        ))}
      </section>

      {/* Yearly chart */}
      {yearlyStats.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.yearByYear}</h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <YearlyChart
              data={yearlyStats}
              metric="distanceKm"
              metricLabels={{
                distanceKm: d.charts.yearly.distance,
                elevationM: d.charts.yearly.elevation,
                rides: d.charts.yearly.rides,
              }}
            />
          </div>
        </section>
      )}

      {/* Country breakdown */}
      {countries.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.byCountry}</h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-500 font-normal">{d.dashboard.table.country}</th>
                  <th className="px-4 py-3 text-gray-500 font-normal text-right">{d.dashboard.table.rides}</th>
                  <th className="px-4 py-3 text-gray-500 font-normal text-right">{d.dashboard.table.distance}</th>
                  <th className="px-4 py-3 text-gray-500 font-normal text-right">{d.dashboard.table.elevation}</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((c) => (
                  <tr key={c.country} className="border-b border-gray-900 hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-3 text-white">{getCountryName(c.countryCode, locale, c.country)}</td>
                    <td className="px-4 py-3 text-gray-400 text-right">{c.rides}</td>
                    <td className="px-4 py-3 text-gray-400 text-right">{c.distanceKm.toLocaleString()} km</td>
                    <td className="px-4 py-3 text-gray-400 text-right">{c.elevationM.toLocaleString()} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Top climbs */}
      {topClimbs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.topClimbs}</h2>
          <div className="space-y-3">
            {topClimbs.map((ride, i) => (
              <a
                key={ride.id}
                href={`/${locale}/rides/${countryToSlug(ride.country)}/${ride.slug}`}
                className="flex items-center gap-4 bg-gray-950 border border-gray-800 rounded-lg p-4 hover:border-strava transition-colors group"
              >
                <span className="text-3xl font-mono font-bold text-gray-700 w-8 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate group-hover:text-strava transition-colors">
                    {ride.name}
                  </p>
                  <p className="text-xs text-gray-500">{getCountryName(ride.countryCode, locale, ride.country ?? '')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-mono">{Math.round(ride.elevationM).toLocaleString()} m</p>
                  <p className="text-xs text-gray-500">{ride.distanceKm.toFixed(1)} km</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {stats.totalRides === 0 && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-sm">
            {d.dashboard.empty.split('{cmd}')[0]}
            <code className="bg-gray-900 px-1 rounded text-gray-400">npm run sync:strava</code>
            {d.dashboard.empty.split('{cmd}')[1]}
          </p>
        </div>
      )}
    </div>
  )
}
