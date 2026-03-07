import React from 'react'
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
import { getDictionary } from '@/lib/i18n'
import { getCountryName } from '@/lib/countryNames'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const chartLoading = { loading: () => <div className="h-[240px] bg-gray-950 animate-pulse rounded" /> }
const MonthlyHeatmap = dynamicImport(() => import('@/components/charts/MonthlyHeatmap'), { ssr: false, ...chartLoading })
const CumulativeChart = dynamicImport(() => import('@/components/charts/CumulativeChart'), { ssr: false, ...chartLoading })
const RideTypeChart = dynamicImport(() => import('@/components/charts/RideTypeChart'), { ssr: false, ...chartLoading })
const MonthlyChart = dynamicImport(() => import('@/components/charts/MonthlyChart'), { ssr: false, ...chartLoading })
const CountryTimeline = dynamicImport(() => import('@/components/charts/CountryTimeline'), { ssr: false })

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDictionary()
  return { title: d.dashboard.title }
}

function countryToSlug(country: string | null): string {
  return country?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown'
}

export default async function DashboardPage() {
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
    getDictionary(),
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
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">{d.dashboard.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{d.dashboard.subtitle}</p>
      </div>

      {/* 1. Global totals */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {statItems.map(({ v, l }) => (
          <div key={l} className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-mono font-bold text-strava">{v}</p>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">{l}</p>
          </div>
        ))}
      </section>

      {/* Milestone Counters: Everest + Circumnavigation */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Everest Counter */}
        {(() => {
          const EVEREST_M = 8849
          const everests = stats.totalElevationM / EVEREST_M
          const wholeMountains = Math.floor(everests)
          const pctCurrent = ((everests - wholeMountains) * 100)
          return (
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">에베레스트 등반</p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-mono font-bold text-strava">{wholeMountains}</span>
                <span className="text-sm text-gray-500">회 완등</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all" style={{ width: `${Math.min(pctCurrent, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-600">
                다음 등반까지 {pctCurrent.toFixed(1)}% · {Math.round(stats.totalElevationM).toLocaleString()}m / {((wholeMountains + 1) * EVEREST_M).toLocaleString()}m
              </p>
            </div>
          )
        })()}

        {/* Circumnavigation Counter */}
        {(() => {
          const EARTH_KM = 40075
          const laps = stats.totalDistanceKm / EARTH_KM
          const wholeLaps = Math.floor(laps)
          const pctCurrent = ((laps - wholeLaps) * 100)
          return (
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">지구 일주</p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-mono font-bold text-strava">{wholeLaps}</span>
                <span className="text-sm text-gray-500">회 일주</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all" style={{ width: `${Math.min(pctCurrent, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-600">
                다음 일주까지 {pctCurrent.toFixed(1)}% · {stats.totalDistanceKm.toLocaleString()}km / {((wholeLaps + 1) * EARTH_KM).toLocaleString()}km
              </p>
            </div>
          )
        })()}
      </section>

      {/* 2. Eddington + Average Ride + Century */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Eddington */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{d.dashboard.eddington.title}</p>
          <p className="text-4xl font-mono font-bold text-strava">E{eddington.eddingtonNumber}</p>
          {eddington.ridesNeeded > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {d.dashboard.eddington.ridesNeeded
                .replace('{n}', String(eddington.ridesNeeded))
                .replaceAll('{e}', String(eddington.eddingtonNumber + 1))}
            </p>
          )}
        </div>

        {/* Average Ride */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.personalRecords.title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {prItems.map(({ label, rec, unit }) => (
            <div key={label} className="bg-gray-950 border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
              {rec ? (
                <a href={`/rides/${countryToSlug(rec.country)}/${rec.slug}`} className="block group">
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
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Streaks */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.heatmap.title}</h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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

      {/* 6–7. Year by Year + Monthly Breakdown (side-by-side on lg) */}
      {(yearlyStats.length > 0 || monthlyBreakdown.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {yearlyStats.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.yearByYear}</h2>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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

          {monthlyBreakdown.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.monthlyBreakdown.title}</h2>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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
        </div>
      )}

      {/* 8–9. Cumulative Distance + Ride Type (side-by-side on lg) */}
      {(cumulativeDistance.length > 0 || rideTypes.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {cumulativeDistance.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.cumulative.title}</h2>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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

          {rideTypes.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.rideTypes.title}</h2>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
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
        </div>
      )}

      {/* 10–11. Country Route (merged timeline + breakdown in ㄹ pattern) */}
      {countryTimeline.length > 0 && (() => {
        const getFlag = (code: string | null) => {
          if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return '';
          return String.fromCodePoint(...code.toUpperCase().split('').map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
        };
        const timelineItems = countryTimeline.map(cv => {
          const stats = countries.find(c => c.country === cv.country);
          const parts = cv.firstVisitDate.split('-');
          const [y, m, dd] = [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
          return {
            flag: getFlag(cv.countryCode),
            countryName: getCountryName(cv.countryCode, 'ko', cv.country),
            date: `${y}.${m}.${dd}`,
            totalRides: cv.totalRides,
            distanceKm: stats?.distanceKm ?? 0,
            href: `/rides/${countryToSlug(cv.country)}/${cv.firstRideSlug}`,
          };
        });
        return (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.countryTimeline.title}</h2>
            <CountryTimeline items={timelineItems} ridesSuffix={d.dashboard.countryTimeline.rides} />
          </section>
        );
      })()}

      {/* 11–12. Top Climbs + Top Rides — Record Board #1 + Bar Chart #2–10 */}
      {(topClimbs.length > 0 || topRides.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {topClimbs.length > 0 && (() => {
            const maxElev = topClimbs[0].elevationM;
            const top1 = topClimbs[0];
            const rest = topClimbs.slice(1);
            const fmtDate = (dt: Date) => `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
            return (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.topClimbs}</h2>
                {/* #1 — Record Board */}
                <a
                  href={`/rides/${countryToSlug(top1.country)}/${top1.slug}`}
                  className="block relative overflow-hidden rounded-xl bg-gray-950 border border-gray-800 p-5 hover:border-orange-500/50 transition-all group mb-3"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 to-red-600" />
                  <div className="pl-4">
                    <p className="text-4xl sm:text-5xl font-mono font-black tracking-tight bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                      {Math.round(top1.elevationM).toLocaleString()} m
                    </p>
                    <p className="text-lg text-white font-semibold mt-1 group-hover:text-orange-400 transition-colors truncate">
                      {top1.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {getCountryName(top1.countryCode, 'ko', top1.country ?? '')} · {fmtDate(top1.startedAt)} · {top1.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                </a>
                {/* #2–10 — Horizontal Bar Chart */}
                <div className="space-y-1">
                  {rest.map((ride, i) => {
                    const pct = (ride.elevationM / maxElev) * 100;
                    return (
                      <a
                        key={ride.id}
                        href={`/rides/${countryToSlug(ride.country)}/${ride.slug}`}
                        className="relative flex items-center gap-2 h-9 rounded-md overflow-hidden group"
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500/20 to-red-500/5 rounded-md transition-all group-hover:from-orange-500/30 group-hover:to-red-500/10"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative text-xs font-mono text-gray-600 w-5 text-right shrink-0 pl-1">{i + 2}</span>
                        <span className="relative flex-1 text-sm text-gray-300 truncate group-hover:text-orange-400 transition-colors">{ride.name}</span>
                        <span className="relative text-sm font-mono text-white shrink-0 pr-2">{Math.round(ride.elevationM).toLocaleString()} m</span>
                      </a>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {topRides.length > 0 && (() => {
            const maxDist = topRides[0].distanceKm;
            const top1 = topRides[0];
            const rest = topRides.slice(1);
            const fmtDate = (dt: Date) => `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
            return (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">{d.dashboard.topRides}</h2>
                {/* #1 — Record Board */}
                <a
                  href={`/rides/${countryToSlug(top1.country)}/${top1.slug}`}
                  className="block relative overflow-hidden rounded-xl bg-gray-950 border border-gray-800 p-5 hover:border-sky-500/50 transition-all group mb-3"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-sky-400 to-blue-600" />
                  <div className="pl-4">
                    <p className="text-4xl sm:text-5xl font-mono font-black tracking-tight bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                      {top1.distanceKm.toFixed(1)} km
                    </p>
                    <p className="text-lg text-white font-semibold mt-1 group-hover:text-sky-400 transition-colors truncate">
                      {top1.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {getCountryName(top1.countryCode, 'ko', top1.country ?? '')} · {fmtDate(top1.startedAt)} · {Math.round(top1.elevationM).toLocaleString()} m
                    </p>
                  </div>
                </a>
                {/* #2–10 — Horizontal Bar Chart */}
                <div className="space-y-1">
                  {rest.map((ride, i) => {
                    const pct = (ride.distanceKm / maxDist) * 100;
                    return (
                      <a
                        key={ride.id}
                        href={`/rides/${countryToSlug(ride.country)}/${ride.slug}`}
                        className="relative flex items-center gap-2 h-9 rounded-md overflow-hidden group"
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500/20 to-blue-500/5 rounded-md transition-all group-hover:from-sky-500/30 group-hover:to-blue-500/10"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative text-xs font-mono text-gray-600 w-5 text-right shrink-0 pl-1">{i + 2}</span>
                        <span className="relative flex-1 text-sm text-gray-300 truncate group-hover:text-sky-400 transition-colors">{ride.name}</span>
                        <span className="relative text-sm font-mono text-white shrink-0 pr-2">{ride.distanceKm.toFixed(1)} km</span>
                      </a>
                    );
                  })}
                </div>
              </section>
            );
          })()}
        </div>
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
