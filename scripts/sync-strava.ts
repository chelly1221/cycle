import "dotenv/config";
import { fetchActivities } from "../lib/strava";
import { upsertRide } from "../lib/sync-helpers";
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
    try {
      await upsertRide(activity);
      console.log(
        `  [OK] ${activity.name} — ${(activity.distance / 1000).toFixed(1)} km`
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
