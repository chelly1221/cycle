import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/strava";
import { db } from "@/lib/db";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://cycle.3chan.kr";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  // Redirect target based on where the OAuth flow started
  const redirectBase = state === "admin" ? "/admin" : "/dashboard";

  if (error || !code) {
    return NextResponse.redirect(`${BASE_URL}${redirectBase}?error=strava_denied`);
  }

  try {
    const data = await exchangeCodeForToken(code);

    await db.stravaToken.upsert({
      where: { athleteId: BigInt(data.athlete.id) },
      create: {
        athleteId: BigInt(data.athlete.id),
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(data.expires_at * 1000),
        scope: data.scope,
      },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(data.expires_at * 1000),
        scope: data.scope,
      },
    });

    return NextResponse.redirect(`${BASE_URL}${redirectBase}?connected=true`);
  } catch (err) {
    console.error("Strava callback error:", err);
    return NextResponse.redirect(
      `${BASE_URL}${redirectBase}?error=token_exchange`
    );
  }
}
