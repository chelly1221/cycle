import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getStravaCredentials } from "@/lib/strava";
import crypto from "crypto";

const STRAVA_API = "https://www.strava.com/api/v3";
const CALLBACK_URL = "https://cycle.3chan.kr/api/strava/webhook";

function isAdmin(): boolean {
  const adminCookie = cookies().get("admin_auth")?.value;
  const adminPw = process.env.ADMIN_PASSWORD;
  return !!(adminPw && adminCookie === adminPw);
}

// ─── GET: Check subscription status ────────────────────────────────────────
export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.siteSettings.findUnique({
    where: { id: "default" },
    select: { stravaWebhookId: true },
  });

  return NextResponse.json({
    active: !!settings?.stravaWebhookId,
    subscriptionId: settings?.stravaWebhookId ?? null,
  });
}

// ─── POST: Create subscription ─────────────────────────────────────────────
export async function POST() {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const creds = await getStravaCredentials();
    const verifyToken = crypto.randomBytes(16).toString("hex");

    // Save verify token BEFORE calling Strava (Strava will call our GET endpoint)
    await db.siteSettings.upsert({
      where: { id: "default" },
      create: { id: "default", stravaWebhookVerifyToken: verifyToken },
      update: { stravaWebhookVerifyToken: verifyToken },
    });

    const params = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      callback_url: CALLBACK_URL,
      verify_token: verifyToken,
    });

    const res = await fetch(`${STRAVA_API}/push_subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[Webhook] Subscription creation failed:", res.status, errBody);
      // Clean up verify token on failure
      await db.siteSettings.update({
        where: { id: "default" },
        data: { stravaWebhookVerifyToken: null },
      });
      return NextResponse.json(
        { error: `Strava API error: ${res.status}`, detail: errBody },
        { status: 502 }
      );
    }

    const data = await res.json();
    const subscriptionId = data.id;

    // Save subscription ID
    await db.siteSettings.update({
      where: { id: "default" },
      data: { stravaWebhookId: subscriptionId },
    });

    console.log(`[Webhook] Subscription created: ${subscriptionId}`);
    return NextResponse.json({ active: true, subscriptionId });
  } catch (err) {
    console.error("[Webhook] Subscription error:", err);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}

// ─── DELETE: Remove subscription ───────────────────────────────────────────
export async function DELETE() {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await db.siteSettings.findUnique({
      where: { id: "default" },
      select: { stravaWebhookId: true },
    });

    if (!settings?.stravaWebhookId) {
      return NextResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    const creds = await getStravaCredentials();
    const subId = settings.stravaWebhookId;

    const res = await fetch(
      `${STRAVA_API}/push_subscriptions/${subId}?client_id=${creds.clientId}&client_secret=${creds.clientSecret}`,
      { method: "DELETE" }
    );

    if (!res.ok && res.status !== 404) {
      const errBody = await res.text().catch(() => "");
      console.error("[Webhook] Subscription deletion failed:", res.status, errBody);
      return NextResponse.json(
        { error: `Strava API error: ${res.status}` },
        { status: 502 }
      );
    }

    // Clear from DB
    await db.siteSettings.update({
      where: { id: "default" },
      data: { stravaWebhookId: null, stravaWebhookVerifyToken: null },
    });

    console.log(`[Webhook] Subscription ${subId} deleted`);
    return NextResponse.json({ active: false, subscriptionId: null });
  } catch (err) {
    console.error("[Webhook] Delete error:", err);
    return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 });
  }
}
