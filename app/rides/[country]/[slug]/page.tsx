import { notFound } from "next/navigation";
import dynamicImport from "next/dynamic";
import { db } from "@/lib/db";
import YouTubeEmbed from "@/components/embeds/YouTubeEmbed";
import ElevationChart from "@/components/charts/ElevationChart";
import type { Metadata } from "next";
import { MediaType } from "@prisma/client";

const RideMap = dynamicImport(() => import("@/components/map/RideMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-950 animate-pulse rounded-lg" />
  ),
});

interface Params {
  country: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const ride = await db.ride.findUnique({
    where: { slug: params.slug },
    select: { name: true, country: true, description: true },
  });
  if (!ride) return {};
  return {
    title: ride.name,
    description: ride.description ?? `${ride.name} — ${ride.country}`,
  };
}

export const dynamic = "force-dynamic";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default async function RidePage({ params }: { params: Params }) {
  const ride = await db.ride.findUnique({
    where: { slug: params.slug },
    include: { media: { orderBy: { sortOrder: "asc" } } },
  });

  if (!ride) notFound();

  const youtube = ride.media.find((m) => m.type === MediaType.YOUTUBE);
  const elevationData = ride.elevationProfile
    ? (
        ride.elevationProfile as {
          distance: number;
          altitude: number;
        }[]
      )
    : [];

  const avgSpeedKmh =
    ride.distanceM / 1000 / (ride.movingTimeSec / 3600);

  return (
    <article className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-strava text-xs font-mono uppercase tracking-widest mb-2">
          {ride.country} ·{" "}
          {new Date(ride.startedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          {ride.name}
        </h1>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { v: `${(ride.distanceM / 1000).toFixed(1)} km`, l: "Distance" },
            {
              v: `${Math.round(ride.elevationM).toLocaleString()} m`,
              l: "Elevation",
            },
            { v: formatDuration(ride.movingTimeSec), l: "Moving time" },
            { v: `${avgSpeedKmh.toFixed(1)} km/h`, l: "Avg speed" },
          ].map(({ v, l }) => (
            <div key={l} className="bg-gray-950 rounded-lg p-4">
              <p className="text-2xl font-mono font-bold text-white">{v}</p>
              <p className="text-xs text-gray-500 mt-1">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* YouTube embed */}
      {youtube && (
        <div className="mb-10">
          <YouTubeEmbed url={youtube.url} title={ride.name} />
        </div>
      )}

      {/* Route map */}
      {ride.polyline && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">Route</h2>
          <RideMap polyline={ride.polyline} />
        </div>
      )}

      {/* Elevation profile */}
      {elevationData.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">
            Elevation Profile
          </h2>
          <div className="bg-gray-950 rounded-lg p-4">
            <ElevationChart data={elevationData} />
          </div>
        </div>
      )}

      {/* Story */}
      {ride.story && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">The Ride</h2>
          <p className="text-gray-400 leading-relaxed whitespace-pre-line">
            {ride.story}
          </p>
        </div>
      )}

      {/* Description (shorter Strava text) */}
      {ride.description && !ride.story && (
        <div className="mb-10">
          <p className="text-gray-400 leading-relaxed">{ride.description}</p>
        </div>
      )}
    </article>
  );
}
