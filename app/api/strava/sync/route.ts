import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchActivities, fetchActivityDetail } from "@/lib/strava";
import { upsertRide, isCyclingActivity } from "@/lib/sync-helpers";
import { db } from "@/lib/db";

function isAuthorized(req: NextRequest): boolean {
  // 1. Admin cookie auth
  const adminCookie = cookies().get("admin_auth")?.value;
  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw && adminCookie === adminPw) return true;

  // 2. Bearer token auth (for cron / external calls)
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true; // open if no secret configured
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
      await upsertRide(detail);
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
        await upsertRide(activity);
        synced++;
      } catch (err) {
        console.error(`Failed to upsert activity ${activity.id}:`, err);
        errors++;
      }
    }

    // Update lastSyncedAt
    await db.siteSettings.upsert({
      where: { id: "default" },
      create: { id: "default", lastSyncedAt: new Date() },
      update: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({ synced, skipped, errors, total: activities.length, mode });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
