import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchActivities, fetchActivityDetail, fetchActivityPhotos, fetchActivityStreams } from "@/lib/strava";
import { upsertRide, isCyclingActivity, syncPhotosForRide, buildElevationProfile, saveElevationProfile } from "@/lib/sync-helpers";
import { db } from "@/lib/db";
import { getExpectedToken } from "@/lib/auth";
import { generateSitemap } from "@/lib/sitemap";

function isAuthorized(req: NextRequest): boolean {
  // 1. Admin cookie auth
  const adminCookie = cookies().get("admin_auth")?.value;
  const expectedToken = getExpectedToken();
  if (expectedToken && adminCookie === expectedToken) return true;

  // 2. Bearer token auth (for cron / external calls)
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false; // closed if no secret configured
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const mode: string = body.mode || "incremental";

    // ─── Photos mode: sync photos for rides that have them ──────────
    if (mode === "photos") {
      // 1. Fetch all activities from Strava (uses list endpoint — 1-3 API calls)
      const allActivities = await fetchActivities();
      const withPhotos = allActivities.filter(
        (a) => a.total_photo_count && a.total_photo_count > 0
      );

      // 2. Find which of those rides don't have STRAVA_PHOTO in DB yet
      const stravaIds = withPhotos.map((a) => BigInt(a.id));
      const existingMedia = await db.ride.findMany({
        where: {
          stravaId: { in: stravaIds },
          media: { some: { type: "STRAVA_PHOTO" } },
        },
        select: { stravaId: true },
      });
      const alreadySynced = new Set(existingMedia.map((r) => r.stravaId.toString()));

      const toSync = withPhotos.filter(
        (a) => !alreadySynced.has(a.id.toString())
      );

      // 3. Fetch photos only for those rides (1 API call each)
      let totalPhotos = 0;
      const syncedNames: string[] = [];
      for (const activity of toSync) {
        const ride = await db.ride.findUnique({
          where: { stravaId: BigInt(activity.id) },
          select: { id: true },
        });
        if (!ride) continue;
        try {
          const count = await syncPhotosForRide(activity.id, ride.id);
          totalPhotos += count;
          syncedNames.push(`${activity.name} (${count})`);
          console.log(`[Photos] ${activity.name}: ${count} photos`);
        } catch (err) {
          console.error(`[Photos] Failed for ${activity.name}:`, err);
        }
      }
      return NextResponse.json({
        mode,
        activitiesWithPhotos: withPhotos.length,
        alreadySynced: alreadySynced.size,
        newlySynced: syncedNames.length,
        totalPhotos,
        syncedNames,
      });
    }

    // ─── Single mode: fetch one activity by stravaId ─────────────────
    if (mode === "single") {
      const stravaId = Number(body.stravaId);
      if (!stravaId) {
        return NextResponse.json({ error: "stravaId required for single mode" }, { status: 400 });
      }
      const detail = await fetchActivityDetail(stravaId);
      if (!isCyclingActivity(detail)) {
        return NextResponse.json({ synced: 0, skipped: 1, errors: 0, total: 1, mode, reason: "not cycling" });
      }
      const rideId = await upsertRide(detail);
      if (detail.total_photo_count && detail.total_photo_count > 0) {
        await syncPhotosForRide(stravaId, rideId);
      }
      // Fetch elevation profile
      try {
        const existing = await db.ride.findUnique({ where: { id: rideId }, select: { elevationProfile: true } });
        if (!existing?.elevationProfile) {
          const streams = await fetchActivityStreams(stravaId);
          const profile = buildElevationProfile(streams);
          if (profile) await saveElevationProfile(rideId, profile);
        }
      } catch { /* non-fatal */ }
      return NextResponse.json({ synced: 1, errors: 0, total: 1, mode });
    }

    // ─── Full or Incremental mode ────────────────────────────────────
    let after: Date | undefined;

    if (mode === "incremental") {
      // Try lastSyncedAt from site settings first
      const settings = await db.siteSettings.findUnique({
        where: { id: "default" },
        select: { lastSyncedAt: true },
      });
      if (settings?.lastSyncedAt) {
        after = settings.lastSyncedAt;
      } else {
        // Fallback: most recent ride's startedAt
        const latest = await db.ride.findFirst({
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        });
        if (latest) {
          after = latest.startedAt;
        }
      }
    }
    // mode === "full": after stays undefined → fetch everything

    const activities = await fetchActivities(after);
    let synced = 0;
    let errors = 0;

    let skipped = 0;
    for (const activity of activities) {
      if (!isCyclingActivity(activity)) {
        skipped++;
        continue;
      }
      try {
        const rideId = await upsertRide(activity);
        // Fetch elevation profile for incremental syncs (small number of rides — safe)
        if (mode === "incremental") {
          try {
            const existing = await db.ride.findUnique({ where: { id: rideId }, select: { elevationProfile: true } });
            if (!existing?.elevationProfile) {
              const streams = await fetchActivityStreams(activity.id);
              const profile = buildElevationProfile(streams);
              if (profile) await saveElevationProfile(rideId, profile);
            }
          } catch { /* non-fatal */ }
        }
        synced++;
      } catch (err) {
        console.error(`Failed to upsert activity ${activity.id}:`, err);
        errors++;
      }
    }

    // Update lastSyncedAt only if no errors
    if (errors === 0) {
      await db.siteSettings.upsert({
        where: { id: "default" },
        create: { id: "default", lastSyncedAt: new Date() },
        update: { lastSyncedAt: new Date() },
      });
    }

    // Regenerate static sitemap
    try { await generateSitemap(); } catch (e) { console.error("[Sitemap] Failed:", e); }

    return NextResponse.json({ synced, skipped, errors, total: activities.length, mode });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
