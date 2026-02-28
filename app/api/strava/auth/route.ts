import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/strava";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://cycle.3chan.kr";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") ?? "admin";

  try {
    const url = await buildAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("Failed to build Strava auth URL:", err);
    return NextResponse.redirect(`${BASE_URL}/admin?error=missing_credentials`);
  }
}
