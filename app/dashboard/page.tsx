import {
  getGlobalStats,
  getCountryBreakdown,
  getYearlyStats,
  getTopClimbs,
} from "@/lib/stats";
import YearlyChart from "@/components/charts/YearlyChart";
import { buildAuthUrl } from "@/lib/strava";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "The Ledger" };
export const dynamic = "force-dynamic";

function countryToSlug(country: string | null): string {
  return country?.toLowerCase().replace(/\s+/g, "-") ?? "unknown";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const [stats, countries, yearlyStats, topClimbs] = await Promise.all([
    getGlobalStats(),
    getCountryBreakdown(),
    getYearlyStats(),
    getTopClimbs(10),
  ]);

  const stravaAuthUrl = await buildAuthUrl();

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Status banner */}
      {searchParams.connected && (
        <div className="mb-6 px-4 py-3 bg-green-950 border border-green-800 rounded text-green-400 text-sm">
          Strava connected successfully. Run{" "}
          <code className="bg-green-900 px-1 rounded">npm run sync:strava</code>{" "}
          to import your rides.
        </div>
      )}
      {searchParams.error && (
        <div className="mb-6 px-4 py-3 bg-red-950 border border-red-800 rounded text-red-400 text-sm">
          Strava connection error: {searchParams.error}
        </div>
      )}

      <div className="flex items-baseline justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">The Ledger</h1>
          <p className="text-gray-500 text-sm mt-1">
            Cumulative cycling statistics
          </p>
        </div>
        <a
          href={stravaAuthUrl}
          className="text-xs bg-strava text-white px-4 py-2 rounded hover:bg-orange-600 transition-colors"
        >
          Connect Strava
        </a>
      </div>

      {/* Global totals */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        {[
          { v: stats.totalDistanceKm.toLocaleString(), l: "km total" },
          { v: stats.totalElevationM.toLocaleString(), l: "m climbed" },
          { v: stats.totalMovingHours.toLocaleString(), l: "hours" },
          { v: stats.totalRides, l: "rides" },
          { v: stats.countriesVisited, l: "countries" },
        ].map(({ v, l }) => (
          <div
            key={l}
            className="bg-gray-950 border border-gray-800 rounded-lg p-5 text-center"
          >
            <p className="text-3xl font-mono font-bold text-strava">{v}</p>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">
              {l}
            </p>
          </div>
        ))}
      </section>

      {/* Yearly chart */}
      {yearlyStats.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            Year by Year
          </h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <YearlyChart data={yearlyStats} metric="distanceKm" />
          </div>
        </section>
      )}

      {/* Country breakdown */}
      {countries.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">By Country</h2>
          <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-500 font-normal">
                    Country
                  </th>
                  <th className="px-4 py-3 text-gray-500 font-normal text-right">
                    Rides
                  </th>
                  <th className="px-4 py-3 text-gray-500 font-normal text-right">
                    Distance
                  </th>
                  <th className="px-4 py-3 text-gray-500 font-normal text-right">
                    Elevation
                  </th>
                </tr>
              </thead>
              <tbody>
                {countries.map((c) => (
                  <tr
                    key={c.country}
                    className="border-b border-gray-900 hover:bg-gray-900 transition-colors"
                  >
                    <td className="px-4 py-3 text-white">{c.country}</td>
                    <td className="px-4 py-3 text-gray-400 text-right">
                      {c.rides}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-right">
                      {c.distanceKm.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-right">
                      {c.elevationM.toLocaleString()} m
                    </td>
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
          <h2 className="text-lg font-semibold text-white mb-4">
            Top Climbs by Elevation
          </h2>
          <div className="space-y-3">
            {topClimbs.map((ride, i) => (
              <a
                key={ride.id}
                href={`/rides/${countryToSlug(ride.country)}/${ride.slug}`}
                className="flex items-center gap-4 bg-gray-950 border border-gray-800 rounded-lg p-4 hover:border-strava transition-colors group"
              >
                <span className="text-3xl font-mono font-bold text-gray-700 w-8 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate group-hover:text-strava transition-colors">
                    {ride.name}
                  </p>
                  <p className="text-xs text-gray-500">{ride.country}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-mono">
                    {Math.round(ride.elevationM).toLocaleString()} m
                  </p>
                  <p className="text-xs text-gray-500">
                    {ride.distanceKm.toFixed(1)} km
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {stats.totalRides === 0 && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg mb-2">No rides yet.</p>
          <p className="text-sm">
            Connect Strava above, then run{" "}
            <code className="bg-gray-900 px-1 rounded text-gray-400">
              npm run sync:strava
            </code>
            .
          </p>
        </div>
      )}
    </div>
  );
}
