import { db } from "./db";

const STRAVA_BASE = "https://www.strava.com/api/v3";

// ─── Strava Credentials (DB only — set via /admin) ──────────────────────────

const STRAVA_REDIRECT_URI = "https://cycle.3chan.kr/api/strava/callback";

export async function getStravaCredentials() {
  const settings = await db.siteSettings.findUnique({ where: { id: "default" } });
  const clientId = settings?.stravaClientId;
  const clientSecret = settings?.stravaClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Strava API 자격증명이 설정되지 않았습니다. /admin에서 Client ID와 Client Secret을 입력하세요."
    );
  }

  return { clientId, clientSecret };
}

// ─── Token Management ─────────────────────────────────────────────────────────

export async function getValidToken(): Promise<string> {
  const token = await db.stravaToken.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!token) {
    throw new Error("No Strava token found. Run OAuth flow first.");
  }

  const now = new Date();
  if (token.expiresAt > now) {
    return token.accessToken;
  }

  // Token expired — refresh it
  const creds = await getStravaCredentials();
  const params = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[Strava] Token refresh failed:", res.status, errBody);
    throw new Error(`Strava token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  const expiresAt = new Date(data.expires_at * 1000);

  await db.stravaToken.update({
    where: { id: token.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    },
  });

  return data.access_token;
}

// ─── Activity Types ───────────────────────────────────────────────────────────

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number; // metres
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // metres
  start_date: string; // ISO 8601
  start_latlng: [number, number] | [];
  timezone: string; // e.g. "(GMT+09:00) Asia/Seoul"
  map: {
    summary_polyline: string;
    polyline?: string;
  };
  average_speed: number;
  max_speed: number;
  average_watts?: number;
  weighted_average_watts?: number;
  kudos_count: number;
  description?: string;
}

// ─── Activity Fetching ────────────────────────────────────────────────────────

export async function fetchActivities(
  after?: Date,
  perPage = 100
): Promise<StravaActivity[]> {
  const token = await getValidToken();
  const all: StravaActivity[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      ...(after
        ? { after: String(Math.floor(after.getTime() / 1000)) }
        : {}),
    });

    const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Strava activities fetch failed: ${res.status}`);
    }

    const activities: StravaActivity[] = await res.json();
    all.push(...activities);

    if (activities.length < perPage) break;
    page++;
  }

  return all;
}

export async function fetchActivityDetail(stravaId: number): Promise<
  StravaActivity & { segment_efforts: unknown[] }
> {
  const token = await getValidToken();
  const res = await fetch(`${STRAVA_BASE}/activities/${stravaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Strava activity ${stravaId} fetch failed: ${res.status}`);
  }
  return res.json();
}

// ─── OAuth Helpers ────────────────────────────────────────────────────────────

export async function buildAuthUrl(state?: string): Promise<string> {
  const creds = await getStravaCredentials();
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    ...(state ? { state } : {}),
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string) {
  const creds = await getStravaCredentials();
  const params = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code,
    grant_type: "authorization_code",
  });

  console.log("[Strava] Token exchange request:", {
    client_id: creds.clientId,
    client_secret: creds.clientSecret ? "***set***" : "***EMPTY***",
    code: code.slice(0, 6) + "...",
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[Strava] Token exchange failed:", res.status, errBody);
    throw new Error(`Token exchange failed: ${res.status} — ${errBody}`);
  }
  return res.json();
}
