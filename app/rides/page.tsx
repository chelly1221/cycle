import { db } from "@/lib/db";
import RideCard from "@/components/rides/RideCard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "All Rides" };
export const dynamic = "force-dynamic";

interface SearchParams {
  country?: string;
  type?: string;
}

export default async function RidesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const where: Record<string, unknown> = {};
  if (searchParams.country) where.country = searchParams.country;
  if (searchParams.type) where.type = searchParams.type;

  const [rides, countries] = await Promise.all([
    db.ride.findMany({
      where,
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        country: true,
        countryCode: true,
        distanceM: true,
        elevationM: true,
        movingTimeSec: true,
        startedAt: true,
        type: true,
      },
    }),
    db.ride.groupBy({
      by: ["country"],
      where: { country: { not: null } },
      orderBy: { country: "asc" },
    }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">All Rides</h1>
      <p className="text-gray-500 mb-8">{rides.length} rides in the archive</p>

      {/* Country filter */}
      <div className="flex gap-3 flex-wrap mb-10">
        <a
          href="/rides"
          className={`px-4 py-1.5 rounded text-sm border transition-colors ${
            !searchParams.country
              ? "bg-strava border-strava text-white"
              : "border-gray-700 text-gray-400 hover:border-gray-500"
          }`}
        >
          All countries
        </a>
        {countries.map((c) => (
          <a
            key={c.country}
            href={`/rides?country=${encodeURIComponent(c.country!)}`}
            className={`px-4 py-1.5 rounded text-sm border transition-colors ${
              searchParams.country === c.country
                ? "bg-strava border-strava text-white"
                : "border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            {c.country}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {rides.map((ride) => (
          <RideCard key={ride.id} ride={ride} />
        ))}
      </div>

      {rides.length === 0 && (
        <p className="text-gray-600 text-center py-20">No rides found.</p>
      )}
    </div>
  );
}
