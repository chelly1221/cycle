import { RideType } from "@prisma/client";
import { db } from "./db";
import type { StravaActivity } from "./strava";
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

export async function deleteRideByStravaId(stravaId: number): Promise<boolean> {
  const ride = await db.ride.findUnique({
    where: { stravaId: BigInt(stravaId) },
    select: { id: true },
  });
  if (!ride) return false;
  await db.ride.delete({ where: { id: ride.id } });
  return true;
}

export async function upsertRide(activity: StravaActivity): Promise<void> {
  const startedAt = new Date(activity.start_date);
  const type = mapRideType(activity.sport_type ?? activity.type);

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

  await db.ride.upsert({
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
      type,
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
  });
}
