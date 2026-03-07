import { RideType, MediaType } from "@prisma/client";
import { db } from "./db";
import type { StravaActivity, StravaStreams } from "./strava";
import { fetchActivityPhotos } from "./strava";
import { countryFromTimezone } from "./geo";

function toSlug(name: string, date: Date, suffix?: number): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return suffix ? `${base}-${dateStr}-${suffix}` : `${base}-${dateStr}`;
}

const CYCLING_STRAVA_TYPES = new Set([
  'Ride', 'VirtualRide', 'MountainBikeRide', 'EBikeRide', 'GravelRide', 'Handcycle',
]);

export function isCyclingActivity(activity: StravaActivity): boolean {
  const type = activity.sport_type ?? activity.type;
  return CYCLING_STRAVA_TYPES.has(type);
}

function mapRideType(stravaType: string): RideType {
  const map: Record<string, RideType> = {
    Ride: RideType.RIDE,
    VirtualRide: RideType.VIRTUAL_RIDE,
    MountainBikeRide: RideType.MOUNTAIN_BIKE_RIDE,
    EBikeRide: RideType.E_BIKE_RIDE,
    GravelRide: RideType.GRAVEL_RIDE,
    Handcycle: RideType.HANDCYCLE,
  };
  return map[stravaType] ?? RideType.OTHER;
}

// Zwift world names and other virtual ride indicators
const VIRTUAL_PATTERNS = [
  /^Zwift\s*-/i,
  /\bZwift\b/i,
  /\bin Watopia\b/i,
  /\bin London\b/i,        // Zwift London
  /\bin New York\b/i,      // Zwift NYC
  /\bin France\b/i,        // Zwift France
  /\bin Yorkshire\b/i,     // Zwift Yorkshire
  /\bin Innsbruck\b/i,     // Zwift Innsbruck
  /\bin Richmond\b/i,      // Zwift Richmond
  /\bin Paris\b/i,         // Zwift Paris
  /\bon .+ in /i,          // "on [route] in [world]" Zwift pattern
  /\bvEveresting\b/i,
  /\bTrainerRoad\b/i,
  /\bRGT\b/i,
  /헬스장/,                // gym
  /실내/,                  // indoor
  /스피닝/,                // spinning
  /\bFTP\s*(Ramp\s*)?Test\b/i,
];

/**
 * Detect if a ride is actually virtual/indoor despite Strava classifying it as "Ride".
 * Uses name patterns + the trainer flag from Strava API.
 */
function detectVirtualRide(activity: StravaActivity): boolean {
  if (activity.trainer) return true;
  return VIRTUAL_PATTERNS.some((p) => p.test(activity.name));
}

export async function deleteRideByStravaId(stravaId: number): Promise<boolean> {
  const ride = await db.ride.findUnique({
    where: { stravaId: BigInt(stravaId) },
    select: { id: true },
  });
  if (!ride) return false;
  await db.ride.delete({ where: { id: ride.id } });
  return true;
}

export async function upsertRide(activity: StravaActivity): Promise<string> {
  const startedAt = new Date(activity.start_date);
  let type = mapRideType(activity.sport_type ?? activity.type);

  // Override: detect virtual/indoor rides that Strava classifies as regular "Ride"
  if (type === RideType.RIDE && detectVirtualRide(activity)) {
    type = RideType.VIRTUAL_RIDE;
  }

  const [startLat, startLng] =
    activity.start_latlng.length === 2
      ? (activity.start_latlng as [number, number])
      : [null, null];

  // Resolve country from Strava timezone
  const geo = activity.timezone ? countryFromTimezone(activity.timezone) : null;

  // Try to find a unique slug, appending a counter on collision
  let slug = toSlug(activity.name, startedAt);
  let attempt = 0;
  while (attempt < 10) {
    const existing = await db.ride.findFirst({
      where: { slug, NOT: { stravaId: BigInt(activity.id) } },
      select: { id: true },
    });
    if (!existing) break;
    attempt++;
    slug = toSlug(activity.name, startedAt, attempt + 1);
  }

  const ride = await db.ride.upsert({
    where: { stravaId: BigInt(activity.id) },
    create: {
      stravaId: BigInt(activity.id),
      name: activity.name,
      slug,
      type,
      country: geo?.country ?? null,
      countryCode: geo?.countryCode ?? null,
      distanceM: activity.distance,
      elevationM: activity.total_elevation_gain,
      movingTimeSec: activity.moving_time,
      elapsedTimeSec: activity.elapsed_time,
      startedAt,
      polyline: activity.map?.summary_polyline ?? null,
      startLat,
      startLng,
      averageSpeed: activity.average_speed,
      maxSpeed: activity.max_speed,
      averageWatts: activity.average_watts ?? null,
      weightedAvgWatts: activity.weighted_average_watts ?? null,
      kudosCount: activity.kudos_count,
      description: activity.description ?? null,
    },
    update: {
      name: activity.name,
      // type is NOT updated — preserves manual overrides
      country: geo?.country ?? undefined,
      countryCode: geo?.countryCode ?? undefined,
      distanceM: activity.distance,
      elevationM: activity.total_elevation_gain,
      movingTimeSec: activity.moving_time,
      elapsedTimeSec: activity.elapsed_time,
      polyline: activity.map?.summary_polyline ?? null,
      kudosCount: activity.kudos_count,
      averageWatts: activity.average_watts ?? null,
      weightedAvgWatts: activity.weighted_average_watts ?? null,
    },
    select: { id: true },
  });

  return ride.id;
}

// ─── Elevation Profile ────────────────────────────────────────────────────────

/**
 * Convert Strava altitude+distance streams into a downsampled elevation profile.
 * Targets ~200 points regardless of ride length.
 */
export function buildElevationProfile(
  streams: StravaStreams,
  targetPoints = 200
): { distance: number; altitude: number }[] | null {
  const alt = streams.altitude?.data;
  const dist = streams.distance?.data;
  if (!alt || !dist || alt.length < 2 || dist.length !== alt.length) return null;

  const n = alt.length;
  const step = Math.max(1, Math.floor(n / targetPoints));
  const result: { distance: number; altitude: number }[] = [];

  for (let i = 0; i < n; i += step) {
    result.push({
      distance: parseFloat((dist[i] / 1000).toFixed(2)),
      altitude: Math.round(alt[i]),
    });
  }

  // Always include the final point
  const lastDist = parseFloat((dist[n - 1] / 1000).toFixed(2));
  if (result[result.length - 1]?.distance !== lastDist) {
    result.push({ distance: lastDist, altitude: Math.round(alt[n - 1]) });
  }

  return result;
}

export async function saveElevationProfile(
  rideId: string,
  profile: { distance: number; altitude: number }[]
): Promise<void> {
  await db.ride.update({ where: { id: rideId }, data: { elevationProfile: profile } });
}

// ─── Photo Sync ──────────────────────────────────────────────────────────────

export async function syncPhotosForRide(
  stravaId: number,
  rideId: string
): Promise<number> {
  const photos = await fetchActivityPhotos(stravaId);
  if (photos.length === 0) return 0;

  // Build photo data first
  const photoData = photos
    .map((photo, i) => {
      const url =
        photo.urls["2048"] ?? photo.urls["1800"] ?? photo.urls["600"] ?? photo.urls["100"];
      if (!url) return null;
      return {
        rideId,
        type: MediaType.STRAVA_PHOTO,
        url,
        thumbnailUrl: photo.urls["600"] ?? photo.urls["100"] ?? url,
        title: photo.caption ?? null,
        sortOrder: i,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (photoData.length === 0) return 0;

  // Use transaction for atomic delete + insert
  await db.$transaction(async (tx) => {
    await tx.media.deleteMany({
      where: { rideId, type: MediaType.STRAVA_PHOTO },
    });
    await tx.media.createMany({ data: photoData });
  });

  return photoData.length;
}
