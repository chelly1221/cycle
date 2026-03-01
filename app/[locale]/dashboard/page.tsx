import {
  getGlobalStats,
  getCountryBreakdown,
  getYearlyStats,
  getTopClimbs,
  getTopRidesByDistance,
  getEddingtonNumber,
  getPersonalRecords,
  getAverageRideStats,
  getCenturyCounts,
  getDailyRideCounts,
  getCumulativeDistance,
  getRideTypeBreakdown,
  getMonthlyBreakdown,
  getStreaks,
  getCountryTimeline,
} from '@/lib/stats'
import YearlyChart from '@/components/charts/YearlyChart'
import dynamicImport from 'next/dynamic'
import { getDictionary, type Locale } from '@/lib/i18n'
import { getCountryName } from '@/lib/countryNames'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const chartLoading = { loading: () => <div className="h-[240px] bg-gray-950 animate-pulse rounded" /> }
const MonthlyHeatmap = dynamicImport(() => import('@/components/charts/MonthlyHeatmap'), { ssr: false, ...chartLoading })
const CumulativeChart = dynamicImport(() => import('@/components/charts/CumulativeChart'), { ssr: false, ...chartLoading })
const RideTypeChart = dynamicImport(() => import('@/components/charts/RideTypeChart'), { ssr: false, ...chartLoading })
const MonthlyChart = dynamicImport(() => import('@/components/charts/MonthlyChart'), { ssr: false, ...chartLoading })

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
  const [
    stats,
    countries,
    yearlyStats,
    topClimbs,
    topRides,
    eddington,
    personalRecords,
    averageRide,
    centuries,
    dailyRides,
    cumulativeDistance,
    rideTypes,
    monthlyBreakdown,
    streaks,
    countryTimeline,
    d,
  ] = await Promise.all([
    getGlobalStats(),
    getCountryBreakdown(),
    getYearlyStats(),
    getTopClimbs(10),
    getTopRidesByDistance(10),
    getEddingtonNumber(),
    getPersonalRecords(),
    getAverageRideStats(),
    getCenturyCounts(),
    getDailyRideCounts(365),
    getCumulativeDistance(),
    getRideTypeBreakdown(),
    getMonthlyBreakdown(),
    getStreaks(),
    getCountryTimeline(),
    getDictionary(locale),
  ])

  const statItems = [
    { v: stats.totalDistanceKm.toLocaleString(), l: d.dashboard.stats.km },
    { v: stats.totalElevationM.toLocaleString(), l: d.dashboard.stats.elevation },
    { v: stats.totalMovingHours.toLocaleString(), l: d.dashboard.stats.hours },
    { v: stats.totalRides, l: d.dashboard.stats.rides },
    { v: stats.countriesVisited, l: d.dashboard.stats.countries },
  ]

  // YoY growth: compare last two fully completed years to avoid partial-year distortion
  const sortedYears = [...yearlyStats].sort((a, b) => a.year - b.year)
  const currentYear = new Date().getFullYear()
  const completedYears = sortedYears.filter((y) => y.year < currentYear)
  let yoyGrowth: { distance: number | null; elevation: number | null; rides: number | null } = {
    distance: null, elevation: null, rides: null,
  }
  let yoyCompareYear: number | null = null
  if (completedYears.length >= 2) {
    const curr = completedYears[completedYears.length - 1]
    const prev = completedYears[completedYears.length - 2]
    yoyCompareYear = curr.year
    yoyGrowth = {
      distance: prev.distanceKm > 0 ? Math.round(((curr.distanceKm - prev.distanceKm) / prev.distanceKm) * 100) : null,
      elevation: prev.elevationM > 0 ? Math.round(((curr.elevationM - prev.elevationM) / prev.elevationM) * 100) : null,
      rides: prev.rides > 0 ? Math.round(((curr.rides - prev.rides) / prev.rides) * 100) : null,
    }
  }

  const prItems = [
    { label: d.dashboard.personalRecords.longestRide, rec: personalRecords.longestRide, unit: d.dashboard.personalRecords.units.km },
    { label: d.dashboard.personalRecords.mostElevation, rec: personalRecords.mostElevation, unit: d.dashboard.personalRecords.units.m },
    { label: d.dashboard.personalRecords.fastestAvgSpeed, rec: personalRecords.fastestAvgSpeed, unit: d.dashboard.personalRecords.units.kmh },
    { label: d.dashboard.personalRecords.longestMovingTime, rec: personalRecords.longestMovingTime, unit: d.dashboard.personalRecords.units.hours },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">{d.dashboard.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{d.dashboard.subtitle}</p>
      </div>

      {/* 1. Global totals */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        {statItems.map(({ v, l }) => (
          <div key={l} className="bg-gray-950 border border-gray-800 rounded-lg p-5 text-center">
            <p className="text-3xl font-mono font-bold text-strava">{v}</p>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">{l}</p>
          </div>
        ))}
      </section>

      {/* 2. Eddington + Average Ride + Century */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {/* Eddington */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{d.dashboard.eddington.title}</p>
          <p className="text-4xl font-mono font-bold text-strava">E{eddington.eddingtonNumber}</p>
          {eddington.ridesNeeded > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {d.dashboard.eddington.ridesNeeded
                .replace('{n}', String(eddington.ridesNeeded))
                .replace('{e}', String(eddington.eddingtonNumber + 1))
                .replace('{e}', String(eddington.eddingtonNumber + 1))}
            </p>
          )}
        </div>

        {/* Average Ride */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{d.dashboard.averageRide.title}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-lg font-mono font-bold text-white">{averageRide.avgDistanceKm} <span className="text-xs text-gray-500">{d.dashboard.averageRide.units.km}</span></p>
              <p className="text-xs text-gray-500">{d.dashboard.averageRide.distance}</p>
            </div>
            <div>
              <p className="text-lg font-mono font-bold text-white">{averageRide.avgElevationM} <span className="text-xs text-gray-500">{d.dashboard.averageRide.units.m}</span></p>
              <p className="text-xs text-gray-500">{d.dashboard.averageRide.elevation}</p>
            </div>
            <div>
              <p className="text-lg font-mono font-bold text-white">{averageRide.avgSpeedKmh} <span className="text-xs text-gray-500">{d.dashboard.averageRide.units.kmh}</span></p>
              <p className="text-xs text-gray-500">{d.dashboard.averageRide.speed}</p>
            </div>
            <div>
              <p className="text-lg font-mono font-bold text-white">{averageRide.avgMovingTimeHours} <span className="text-xs text-gray-500">{d.dashboard.averageRide.units.hours}</span></p>
              <p className="text-xs text-gray-500">{d.dashboard.averageRide.movingTime}</p>
            </div>
          </div>
        </div>

        {/* Century Rides */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{d.dashboard.centuries.title}</p>
          <div className="space-y-2">
            {[
              { label: d.dashboard.centuries.c100, count: centuries.century100 },
              { label: d.dashboard.centuries.c200, count: centuries.century200 },
              { label: d.dashboard.centuries.c300, count: centuries.century300 },
            ].map(({ label, count }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="text-lg font-mono font-bold text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Personal Records */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.personalRecords.title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {prItems.map(({ label, rec, unit }) => (
            <div key={label} className="bg-gray-950 border border-gray-800 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
              {rec ? (
                <a href={`/${locale}/rides/${countryToSlug(rec.country)}/${rec.slug}`} className="block group">
                  <p className="text-2xl font-mono font-bold text-strava group-hover:text-white transition-colors">
                    {rec.value} <span className="text-sm text-gray-500">{unit}</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-1">{rec.name}</p>
                </a>
              ) : (
                <p className="text-2xl font-mono font-bold text-gray-700">—</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 4. Streaks + YoY Growth */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {/* Streaks */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{d.dashboard.streaks.title}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-mono font-bold text-strava">{streaks.longestStreak}</p>
              <p className="text-xs text-gray-500 mt-1">{d.dashboard.streaks.longest} ({d.dashboard.streaks.days})</p>
              {streaks.longestStreakStart && streaks.longestStreakEnd && (
                <p className="text-xs text-gray-600 mt-0.5">{streaks.longestStreakStart} → {streaks.longestStreakEnd}</p>
              )}
            </div>
            <div>
              <p className="text-3xl font-mono font-bold text-white">{streaks.currentStreak}</p>
              <p className="text-xs text-gray-500 mt-1">{d.dashboard.streaks.current} ({d.dashboard.streaks.days})</p>
            </div>
          </div>
        </div>

        {/* YoY Growth */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{d.dashboard.yoyGrowth.title}</p>
          {yoyCompareYear !== null ? (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: d.dashboard.yoyGrowth.distance, value: yoyGrowth.distance },
                { label: d.dashboard.yoyGrowth.elevation, value: yoyGrowth.elevation },
                { label: d.dashboard.yoyGrowth.rides, value: yoyGrowth.rides },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className={`text-2xl font-mono font-bold ${value !== null && value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {value !== null ? `${value > 0 ? '+' : ''}${value}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
              <p className="col-span-3 text-xs text-gray-600">
                {yoyCompareYear} {d.dashboard.yoyGrowth.vsLastYear}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">{d.dashboard.streaks.noStreak}</p>
          )}
        </div>
      </section>

      {/* 5. Activity Heatmap */}
      {dailyRides.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.heatmap.title}</h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <MonthlyHeatmap
              data={dailyRides}
              labels={{
                title: d.dashboard.heatmap.title,
                rides: d.dashboard.heatmap.rides,
                km: d.dashboard.heatmap.km,
                less: d.dashboard.heatmap.less,
                more: d.dashboard.heatmap.more,
                months: d.dashboard.heatmap.months,
              }}
            />
          </div>
        </section>
      )}

      {/* 6. Year by Year (existing) */}
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

      {/* 7. Monthly Breakdown */}
      {monthlyBreakdown.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.monthlyBreakdown.title}</h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <MonthlyChart
              data={monthlyBreakdown}
              metric="distanceKm"
              monthNames={d.dashboard.monthlyBreakdown.months}
              metricLabels={{
                distanceKm: d.charts.yearly.distance,
                elevationM: d.charts.yearly.elevation,
                rides: d.charts.yearly.rides,
              }}
            />
          </div>
        </section>
      )}

      {/* 8. Cumulative Distance */}
      {cumulativeDistance.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.cumulative.title}</h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <CumulativeChart
              data={cumulativeDistance}
              labels={{
                distance: d.dashboard.cumulative.distance,
                unit: d.dashboard.cumulative.unit,
              }}
            />
          </div>
        </section>
      )}

      {/* 9. Ride Type Breakdown */}
      {rideTypes.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.rideTypes.title}</h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <RideTypeChart
              data={rideTypes}
              typeLabels={d.dashboard.rideTypes.types}
              labels={{
                rides: d.dashboard.rideTypes.rides,
                distance: d.dashboard.rideTypes.distance,
                unit: d.dashboard.rideTypes.unit,
              }}
            />
          </div>
        </section>
      )}

      {/* 10. Country Visit Timeline */}
      {countryTimeline.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.countryTimeline.title}</h2>
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-800" />
            <div className="space-y-6">
              {countryTimeline.map((cv, i) => {
                const flag = cv.countryCode
                  ? String.fromCodePoint(
                      ...cv.countryCode.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
                    )
                  : '';
                const [y, m, dd] = cv.firstVisitDate.split('-');
                const dateLabel = `${y}.${m}.${dd}`;
                return (
                  <div key={cv.country} className="relative">
                    {/* Node dot */}
                    <div className="absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 border-strava bg-gray-950 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-strava" />
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 font-mono">{dateLabel}</p>
                        <p className="text-white font-medium mt-0.5">
                          {flag && <span className="mr-1.5">{flag}</span>}
                          {getCountryName(cv.countryCode, locale, cv.country)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <a
                            href={`/${locale}/rides/${countryToSlug(cv.country)}/${cv.firstRideSlug}`}
                            className="text-xs text-gray-400 hover:text-strava transition-colors truncate"
                          >
                            {d.dashboard.countryTimeline.firstRide}: {cv.firstRideName}
                          </a>
                          <span className="text-xs text-gray-600 shrink-0">
                            · {cv.totalRides}{d.dashboard.countryTimeline.rides}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 11. Country Breakdown (existing) */}
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

      {/* 11. Top Climbs (existing) */}
      {topClimbs.length > 0 && (
        <section className="mb-12">
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

      {/* 12. Top Rides by Distance */}
      {topRides.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.topRides}</h2>
          <div className="space-y-3">
            {topRides.map((ride, i) => (
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
                  <p className="text-white font-mono">{ride.distanceKm.toFixed(1)} km</p>
                  <p className="text-xs text-gray-500">{Math.round(ride.elevationM).toLocaleString()} m</p>
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
