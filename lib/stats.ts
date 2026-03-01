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

export interface TopRide {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  countryCode: string | null;
  distanceKm: number;
  elevationM: number;
  startedAt: Date;
}

export interface EddingtonResult {
  eddingtonNumber: number;
  ridesAtEPlus1: number;
  ridesNeeded: number;
}

export interface PersonalRecords {
  longestRide: { value: number; name: string; slug: string; country: string | null; countryCode: string | null } | null;
  mostElevation: { value: number; name: string; slug: string; country: string | null; countryCode: string | null } | null;
  fastestAvgSpeed: { value: number; name: string; slug: string; country: string | null; countryCode: string | null } | null;
  longestMovingTime: { value: number; name: string; slug: string; country: string | null; countryCode: string | null } | null;
}

export interface AverageRideStats {
  avgDistanceKm: number;
  avgElevationM: number;
  avgSpeedKmh: number;
  avgMovingTimeHours: number;
}

export interface CenturyCounts {
  century100: number;
  century200: number;
  century300: number;
}

export interface DailyRideCount {
  date: string;
  rides: number;
  distanceKm: number;
}

export interface CumulativePoint {
  date: string;
  cumulativeKm: number;
}

export interface RideTypeCount {
  type: string;
  count: number;
  distanceKm: number;
}

export interface MonthlyBreakdown {
  month: number;
  rides: number;
  distanceKm: number;
  elevationM: number;
}

export interface StreakResult {
  longestStreak: number;
  currentStreak: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
}

export interface CountryFirstVisit {
  country: string;
  countryCode: string | null;
  firstVisitDate: string; // YYYY-MM-DD
  firstRideName: string;
  firstRideSlug: string;
  totalRides: number;
}

// ─── Shared Filters ──────────────────────────────────────────────────────────

/** Non-cycling sports (mapped to OTHER from Strava) — excluded from all queries */
const NON_CYCLING = [RideType.OTHER];
/** Virtual rides — additionally excluded from country/outdoor-specific queries */
const NON_OUTDOOR = [...NON_CYCLING, RideType.VIRTUAL_RIDE];

const CYCLING_ONLY = { type: { notIn: NON_CYCLING } };
const OUTDOOR_ONLY = { type: { notIn: NON_OUTDOOR } };

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getGlobalStats(options?: { excludeTypes?: RideType[] }): Promise<GlobalStats> {
  const excluded = options?.excludeTypes?.length
    ? Array.from(new Set([...NON_CYCLING, ...options.excludeTypes]))
    : NON_CYCLING;
  const typeFilter = { type: { notIn: excluded } };
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
  const excluded = options?.excludeTypes?.length
    ? Array.from(new Set([...NON_OUTDOOR, ...options.excludeTypes]))
    : NON_OUTDOOR;
  const typeFilter = { type: { notIn: excluded } };
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
    WHERE type != 'OTHER'
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
    where: CYCLING_ONLY,
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

export async function getTopRidesByDistance(limit = 10): Promise<TopRide[]> {
  const rides = await db.ride.findMany({
    where: CYCLING_ONLY,
    select: {
      id: true,
      name: true,
      slug: true,
      country: true,
      countryCode: true,
      distanceM: true,
      elevationM: true,
      startedAt: true,
    },
    orderBy: { distanceM: "desc" },
    take: limit,
  });

  return rides.map((r) => ({
    ...r,
    distanceKm: r.distanceM / 1000,
    countryCode: r.countryCode ?? null,
  }));
}

export async function getEddingtonNumber(): Promise<EddingtonResult> {
  const rides = await db.ride.findMany({
    where: CYCLING_ONLY,
    select: { distanceM: true },
    orderBy: { distanceM: "desc" },
  });

  const distancesKm = rides.map((r) => Math.floor(r.distanceM / 1000));
  let eddington = 0;
  for (let i = 0; i < distancesKm.length; i++) {
    if (distancesKm[i] >= i + 1) {
      eddington = i + 1;
    } else {
      break;
    }
  }

  const ridesAtEPlus1 = distancesKm.filter((d) => d >= eddington + 1).length;
  const ridesNeeded = eddington + 1 - ridesAtEPlus1;

  return { eddingtonNumber: eddington, ridesAtEPlus1, ridesNeeded: Math.max(0, ridesNeeded) };
}

export async function getPersonalRecords(): Promise<PersonalRecords> {
  const fields = { name: true, slug: true, country: true, countryCode: true } as const;

  const [longest, mostElev, fastest, longestTime] = await Promise.all([
    db.ride.findFirst({ where: CYCLING_ONLY, select: { distanceM: true, ...fields }, orderBy: { distanceM: "desc" } }),
    db.ride.findFirst({ where: CYCLING_ONLY, select: { elevationM: true, ...fields }, orderBy: { elevationM: "desc" } }),
    db.ride.findFirst({
      select: { averageSpeed: true, ...fields },
      where: { ...CYCLING_ONLY, averageSpeed: { not: null } },
      orderBy: { averageSpeed: "desc" },
    }),
    db.ride.findFirst({ where: CYCLING_ONLY, select: { movingTimeSec: true, ...fields }, orderBy: { movingTimeSec: "desc" } }),
  ]);

  return {
    longestRide: longest
      ? { value: Math.round((longest.distanceM / 1000) * 10) / 10, ...pick(longest) }
      : null,
    mostElevation: mostElev
      ? { value: Math.round(mostElev.elevationM), ...pick(mostElev) }
      : null,
    fastestAvgSpeed: fastest
      ? { value: Math.round((fastest.averageSpeed! * 3.6) * 10) / 10, ...pick(fastest) }
      : null,
    longestMovingTime: longestTime
      ? { value: Math.round((longestTime.movingTimeSec / 3600) * 10) / 10, ...pick(longestTime) }
      : null,
  };
}

function pick(r: { name: string; slug: string; country: string | null; countryCode: string | null }) {
  return { name: r.name, slug: r.slug, country: r.country, countryCode: r.countryCode };
}

export async function getAverageRideStats(): Promise<AverageRideStats> {
  const agg = await db.ride.aggregate({
    where: CYCLING_ONLY,
    _avg: { distanceM: true, elevationM: true, averageSpeed: true, movingTimeSec: true },
  });

  return {
    avgDistanceKm: Math.round(((agg._avg.distanceM ?? 0) / 1000) * 10) / 10,
    avgElevationM: Math.round(agg._avg.elevationM ?? 0),
    avgSpeedKmh: Math.round(((agg._avg.averageSpeed ?? 0) * 3.6) * 10) / 10,
    avgMovingTimeHours: Math.round(((agg._avg.movingTimeSec ?? 0) / 3600) * 10) / 10,
  };
}

export async function getCenturyCounts(): Promise<CenturyCounts> {
  const [c100, c200, c300] = await Promise.all([
    db.ride.count({ where: { ...CYCLING_ONLY, distanceM: { gte: 100000 } } }),
    db.ride.count({ where: { ...CYCLING_ONLY, distanceM: { gte: 200000 } } }),
    db.ride.count({ where: { ...CYCLING_ONLY, distanceM: { gte: 300000 } } }),
  ]);

  return { century100: c100, century200: c200, century300: c300 };
}

export async function getDailyRideCounts(days = 365): Promise<DailyRideCount[]> {
  const rows = await db.$queryRaw<
    Array<{ date: string; rides: number; distance_m: number }>
  >`
    SELECT
      TO_CHAR(started_at, 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS rides,
      COALESCE(SUM(distance_m), 0) AS distance_m
    FROM rides
    WHERE type != 'OTHER'
      AND started_at >= NOW() - MAKE_INTERVAL(days => ${days}::int)
    GROUP BY date
    ORDER BY date
  `;

  return rows.map((r) => ({
    date: r.date,
    rides: Number(r.rides),
    distanceKm: Math.round(Number(r.distance_m) / 1000),
  }));
}

export async function getCumulativeDistance(): Promise<CumulativePoint[]> {
  const rows = await db.$queryRaw<
    Array<{ date: string; cumulative_m: number }>
  >`
    SELECT
      TO_CHAR(started_at, 'YYYY-MM-DD') AS date,
      SUM(distance_m) OVER (ORDER BY started_at) AS cumulative_m
    FROM rides
    WHERE type != 'OTHER'
    ORDER BY started_at
  `;

  // Sample if too many points
  let data = rows.map((r) => ({
    date: r.date,
    cumulativeKm: Math.round(Number(r.cumulative_m) / 1000),
  }));

  if (data.length > 500) {
    const step = Math.ceil(data.length / 500);
    const sampled = data.filter((_, i) => i % step === 0);
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    data = sampled;
  }

  return data;
}

export async function getRideTypeBreakdown(): Promise<RideTypeCount[]> {
  const groups = await db.ride.groupBy({
    by: ["type"],
    where: CYCLING_ONLY,
    _count: { id: true },
    _sum: { distanceM: true },
    orderBy: { _count: { id: "desc" } },
  });

  return groups.map((g) => ({
    type: g.type,
    count: g._count.id,
    distanceKm: Math.round((g._sum.distanceM ?? 0) / 1000),
  }));
}

export async function getMonthlyBreakdown(): Promise<MonthlyBreakdown[]> {
  const rows = await db.$queryRaw<
    Array<{ month: number; rides: number; distance_m: number; elevation_m: number }>
  >`
    SELECT
      EXTRACT(MONTH FROM started_at)::int AS month,
      COUNT(*)::int AS rides,
      COALESCE(SUM(distance_m), 0) AS distance_m,
      COALESCE(SUM(elevation_m), 0) AS elevation_m
    FROM rides
    WHERE type != 'OTHER'
    GROUP BY month
    ORDER BY month
  `;

  return rows.map((r) => ({
    month: Number(r.month),
    rides: Number(r.rides),
    distanceKm: Math.round(Number(r.distance_m) / 1000),
    elevationM: Math.round(Number(r.elevation_m)),
  }));
}

export async function getCountryTimeline(): Promise<CountryFirstVisit[]> {
  const rows = await db.$queryRaw<
    Array<{
      country: string;
      country_code: string | null;
      first_visit_date: string;
      first_ride_name: string;
      first_ride_slug: string;
      total_rides: bigint;
    }>
  >`
    SELECT
      f.country,
      f.country_code,
      f.first_visit_date,
      f.first_ride_name,
      f.first_ride_slug,
      c.total_rides
    FROM (
      SELECT DISTINCT ON (country)
        country,
        country_code,
        TO_CHAR(started_at, 'YYYY-MM-DD') AS first_visit_date,
        name AS first_ride_name,
        slug AS first_ride_slug
      FROM rides
      WHERE country IS NOT NULL
        AND type NOT IN ('OTHER', 'VIRTUAL_RIDE')
      ORDER BY country, started_at ASC
    ) f
    JOIN (
      SELECT country, COUNT(*) AS total_rides
      FROM rides
      WHERE country IS NOT NULL
        AND type NOT IN ('OTHER', 'VIRTUAL_RIDE')
      GROUP BY country
    ) c ON c.country = f.country
    ORDER BY f.first_visit_date ASC
  `;

  return rows.map((r) => ({
    country: r.country,
    countryCode: r.country_code,
    firstVisitDate: r.first_visit_date,
    firstRideName: r.first_ride_name,
    firstRideSlug: r.first_ride_slug,
    totalRides: Number(r.total_rides),
  }));
}

export async function getStreaks(): Promise<StreakResult> {
  const rows = await db.$queryRaw<
    Array<{ date: string }>
  >`
    SELECT DISTINCT TO_CHAR(started_at, 'YYYY-MM-DD') AS date
    FROM rides
    WHERE type != 'OTHER'
    ORDER BY date
  `;

  if (rows.length === 0) {
    return { longestStreak: 0, currentStreak: 0, longestStreakStart: null, longestStreakEnd: null };
  }

  const dates = rows.map((r) => r.date);
  let longest = 1, current = 1;
  let longestStart = 0, longestEnd = 0;
  let streakStart = 0;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current++;
      if (current > longest) {
        longest = current;
        longestStart = streakStart;
        longestEnd = i;
      }
    } else {
      current = 1;
      streakStart = i;
    }
  }

  // Check if current streak extends to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = new Date(dates[dates.length - 1]);
  lastDate.setHours(0, 0, 0, 0);
  const daysSinceLast = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  const activeStreak = daysSinceLast <= 1 ? current : 0;

  return {
    longestStreak: longest,
    currentStreak: activeStreak,
    longestStreakStart: dates[longestStart] ?? null,
    longestStreakEnd: dates[longestEnd] ?? null,
  };
}
