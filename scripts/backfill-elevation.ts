/**
 * Backfill elevation profiles for existing Strava-synced rides that don't have one yet.
 *
 * Usage:
 *   npm run backfill:elevation
 *
 * Rate limits: Strava allows 100 req/15min, 1000 req/day.
 * This script adds a 2s delay between requests to stay safely within limits.
 */
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { fetchActivityStreams } from "../lib/strava";
import { buildElevationProfile, saveElevationProfile } from "../lib/sync-helpers";
import { db } from "../lib/db";

const DELAY_MS = 2000; // 2s between requests → max 30/min, well under the 100/15min limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Find rides that have a stravaId but no elevationProfile
  const rides = await db.ride.findMany({
    where: {
      stravaId: { gte: BigInt(1) },
      elevationProfile: { equals: Prisma.DbNull },
    },
    select: { id: true, stravaId: true, name: true },
    orderBy: { startedAt: "desc" },
  });

  console.log(`Found ${rides.length} rides without elevation profile.`);
  if (rides.length === 0) {
    await db.$disconnect();
    return;
  }

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rides.length; i++) {
    const ride = rides[i];
    const stravaId = Number(ride.stravaId);
    process.stdout.write(`  [${i + 1}/${rides.length}] ${ride.name} ... `);

    try {
      const streams = await fetchActivityStreams(stravaId);
      const profile = buildElevationProfile(streams);
      if (profile) {
        await saveElevationProfile(ride.id, profile);
        console.log(`saved (${profile.length} pts)`);
        saved++;
      } else {
        console.log("no altitude data");
        skipped++;
      }
    } catch (err) {
      console.log(`ERROR: ${err}`);
      errors++;
    }

    // Rate limit delay (skip after last item)
    if (i < rides.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${saved} saved, ${skipped} skipped (no data), ${errors} errors`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
