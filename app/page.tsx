import dynamicImport from "next/dynamic";
import { getGlobalStats, getCountryBreakdown } from "@/lib/stats";

export const dynamic = "force-dynamic";

const WorldMap = dynamicImport(() => import("@/components/map/WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-gray-950 rounded-lg animate-pulse flex items-center justify-center text-gray-600">
      Loading map...
    </div>
  ),
});

export default async function HomePage() {
  const [stats, countries] = await Promise.all([
    getGlobalStats(),
    getCountryBreakdown(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black z-10" />
        {/* Place hero video at public/hero.mp4 */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          src="/hero.mp4"
        />
        <div className="relative z-20 text-center px-4">
          <p className="text-strava font-mono text-xs tracking-[0.3em] uppercase mb-4">
            Personal Cycling Archive
          </p>
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Documenting the world&apos;s
            <br />
            roads, one climb at a time.
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            {stats.totalRides} rides across {stats.countriesVisited} countries
          </p>
        </div>
      </section>

      {/* Live Stats Bar */}
      <section className="bg-road-gray border-y border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
          {[
            {
              value: stats.totalDistanceKm.toLocaleString(),
              label: "km ridden",
            },
            {
              value: stats.totalElevationM.toLocaleString(),
              label: "m climbed",
            },
            {
              value: stats.totalMovingHours.toLocaleString(),
              label: "hours moving",
            },
            { value: stats.totalRides.toLocaleString(), label: "rides" },
            { value: stats.countriesVisited, label: "countries" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-4xl font-mono font-bold text-white">
                {value}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* World Map */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-white mb-6">Roads Ridden</h2>
        <WorldMap visitedCountries={countries} />
        {countries.length === 0 && (
          <p className="text-gray-600 text-sm mt-4 text-center">
            No rides synced yet. Run{" "}
            <code className="bg-gray-900 px-1 rounded">npm run sync:strava</code> after
            connecting Strava on{" "}
            <a href="/dashboard" className="text-strava underline">
              The Ledger
            </a>
            .
          </p>
        )}
      </section>
    </>
  );
}
