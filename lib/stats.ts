import { db } from "./db";
import { RideType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlobalStats {
  totalDistanceKm: number;
  totalElevationM: number;
  totalMovingHours: number;
  totalRides: number;
  countriesVisited: number;
}

export interface CountryBreakdown {
  country: string;
  countryCode: string | null;
  rides: number;
  distanceKm: number;
  elevationM: number;
}

export interface YearlyStat {
  year: number;
  rides: number;
  distanceKm: number;
  elevationM: number;
  movingHours: number;
}

export interface TopClimb {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  countryCode: string | null;
  elevationM: number;
  distanceKm: number;
  startedAt: Date;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getGlobalStats(options?: { excludeTypes?: RideType[] }): Promise<GlobalStats> {
  const typeFilter = options?.excludeTypes?.length
    ? { type: { notIn: options.excludeTypes } }
    : {}
  const [agg, countries] = await Promise.all([
    db.ride.aggregate({
      where: typeFilter,
      _sum: { distanceM: true, elevationM: true, movingTimeSec: true },
      _count: { id: true },
    }),
    db.ride.groupBy({
      by: ["country"],
      where: { country: { not: null }, ...typeFilter },
    }),
  ]);

  return {
    totalDistanceKm: Math.round((agg._sum.distanceM ?? 0) / 1000),
    totalElevationM: Math.round(agg._sum.elevationM ?? 0),
    totalMovingHours: Math.round((agg._sum.movingTimeSec ?? 0) / 3600),
    totalRides: agg._count.id,
    countriesVisited: countries.length,
  };
}

export async function getCountryBreakdown(options?: { excludeTypes?: RideType[] }): Promise<CountryBreakdown[]> {
  const typeFilter = options?.excludeTypes?.length
    ? { type: { notIn: options.excludeTypes } }
    : {}
  const groups = await db.ride.groupBy({
    by: ["country", "countryCode"],
    where: { country: { not: null }, ...typeFilter },
    _count: { id: true },
    _sum: { distanceM: true, elevationM: true },
    orderBy: { _sum: { distanceM: "desc" } },
  });

  return groups.map((g) => ({
    country: g.country!,
    countryCode: g.countryCode,
    rides: g._count.id,
    distanceKm: Math.round((g._sum.distanceM ?? 0) / 1000),
    elevationM: Math.round(g._sum.elevationM ?? 0),
  }));
}

export async function getYearlyStats(): Promise<YearlyStat[]> {
  const rows = await db.$queryRaw<
    Array<{
      year: number;
      rides: number;
      distance_m: number;
      elevation_m: number;
      moving_time_sec: number;
    }>
  >`
    SELECT
      EXTRACT(YEAR FROM started_at)::int AS year,
      COUNT(*)::int                      AS rides,
      COALESCE(SUM(distance_m), 0)       AS distance_m,
      COALESCE(SUM(elevation_m), 0)      AS elevation_m,
      COALESCE(SUM(moving_time_sec), 0)::int AS moving_time_sec
    FROM rides
    GROUP BY year
    ORDER BY year DESC
  `;

  return rows.map((r) => ({
    year: Number(r.year),
    rides: Number(r.rides),
    distanceKm: Math.round(Number(r.distance_m) / 1000),
    elevationM: Math.round(Number(r.elevation_m)),
    movingHours: Math.round(Number(r.moving_time_sec) / 3600),
  }));
}

export async function getTopClimbs(limit = 10): Promise<TopClimb[]> {
  const rides = await db.ride.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      country: true,
      countryCode: true,
      elevationM: true,
      distanceM: true,
      startedAt: true,
    },
    orderBy: { elevationM: "desc" },
    take: limit,
  });

  return rides.map((r) => ({
    ...r,
    distanceKm: r.distanceM / 1000,
    countryCode: r.countryCode ?? null,
  }));
}
