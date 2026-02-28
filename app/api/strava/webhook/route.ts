import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchActivityDetail } from "@/lib/strava";
import { upsertRide, deleteRideByStravaId } from "@/lib/sync-helpers";

// ─── GET: Strava webhook subscription verification ─────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !challenge) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Verify the token matches what we stored
  const settings = await db.siteSettings.findUnique({
    where: { id: "default" },
    select: { stravaWebhookVerifyToken: true },
  });

  if (!settings?.stravaWebhookVerifyToken || settings.stravaWebhookVerifyToken !== token) {
    console.error("[Webhook] Verify token mismatch");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  console.log("[Webhook] Subscription verified");
  return NextResponse.json({ "hub.challenge": challenge });
}

// ─── POST: Strava webhook event ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();
    console.log("[Webhook] Event received:", event.object_type, event.aspect_type, event.object_id);

    // Only handle activity events
    if (event.object_type !== "activity") {
      return NextResponse.json({ ok: true });
    }

    const stravaId = Number(event.object_id);

    if (event.aspect_type === "create" || event.aspect_type === "update") {
      try {
        const detail = await fetchActivityDetail(stravaId);
        await upsertRide(detail);
        console.log(`[Webhook] Upserted activity ${stravaId}`);
      } catch (err) {
        console.error(`[Webhook] Failed to upsert activity ${stravaId}:`, err);
      }
    } else if (event.aspect_type === "delete") {
      const deleted = await deleteRideByStravaId(stravaId);
      console.log(`[Webhook] Delete activity ${stravaId}: ${deleted ? "removed" : "not found"}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Error processing event:", err);
    return NextResponse.json({ ok: true }); // Always return 200 to Strava
  }
}
