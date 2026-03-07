import "dotenv/config";
import { fetchActivities, fetchActivityStreams } from "../lib/strava";
import { upsertRide, isCyclingActivity, syncPhotosForRide, buildElevationProfile, saveElevationProfile } from "../lib/sync-helpers";
import { db } from "../lib/db";

async function main() {
  console.log("Starting Strava sync...");

  const latest = await db.ride.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true, stravaId: true, name: true },
  });

  const after = latest?.startedAt;
  console.log(
    `Fetching activities after: ${after?.toISOString() ?? "beginning of time"}`
  );
  if (latest) {
    console.log(`  Last synced: "${latest.name}" (${latest.stravaId})`);
  }

  const activities = await fetchActivities(after);
  console.log(`Found ${activities.length} activities to process`);

  let synced = 0;
  let errors = 0;

  for (const activity of activities) {
    if (!isCyclingActivity(activity)) continue;
    try {
      const rideId = await upsertRide(activity);

      // Fetch elevation profile from Strava Streams API (if not already stored)
      const existing = await db.ride.findUnique({ where: { id: rideId }, select: { elevationProfile: true } });
      if (!existing?.elevationProfile) {
        try {
          const streams = await fetchActivityStreams(activity.id);
          const profile = buildElevationProfile(streams);
          if (profile) await saveElevationProfile(rideId, profile);
        } catch (err) {
          console.warn(`  [WARN] Elevation streams for ${activity.name}:`, err);
        }
      }

      let photoMsg = "";
      if (activity.total_photo_count && activity.total_photo_count > 0) {
        const photoCount = await syncPhotosForRide(activity.id, rideId);
        photoMsg = ` (${photoCount} photos)`;
      }
      console.log(
        `  [OK] ${activity.name} — ${(activity.distance / 1000).toFixed(1)} km${photoMsg}`
      );
      synced++;
    } catch (err) {
      console.error(`  [ERR] ${activity.name} (${activity.id}):`, err);
      errors++;
    }
  }

  console.log(
    `\nSync complete: ${synced} synced, ${errors} errors`
  );

  await db.$disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal sync error:", err);
  process.exit(1);
});
