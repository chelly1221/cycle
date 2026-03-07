import Link from "next/link";
import { db } from "@/lib/db";
import SyncButton from "./SyncButton";
import WebhookStatus from "./WebhookStatus";
import StravaSettings from "./StravaSettings";

export const dynamic = "force-dynamic";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: { error?: string; connected?: string };
}) {
  const [token, siteSettings, rideCount] = await Promise.all([
    db.stravaToken.findFirst({ orderBy: { createdAt: "desc" } }),
    db.siteSettings.findUnique({ where: { id: "default" } }),
    db.ride.count(),
  ]);

  const stravaConnected = !!token;
  const stravaConfigured = !!(siteSettings?.stravaClientId && siteSettings?.stravaClientSecret);

  // Token expiry
  let tokenExpiryLabel = "";
  if (token) {
    const diffMs = token.expiresAt.getTime() - Date.now();
    if (diffMs <= 0) {
      tokenExpiryLabel = "만료됨";
    } else {
      const diffH = Math.floor(diffMs / 3_600_000);
      const diffM = Math.floor((diffMs % 3_600_000) / 60_000);
      tokenExpiryLabel =
        diffH > 0 ? `${diffH}시간 ${diffM}분 후 만료` : `${diffM}분 후 만료`;
    }
  }

  const errorMessages: Record<string, string> = {
    token_exchange: "Strava 인증 실패 — Client ID 또는 Client Secret이 올바르지 않습니다.",
    strava_denied: "Strava 인증이 거부되었습니다.",
    missing_credentials: "Strava API 자격증명이 설정되지 않았습니다. 아래에서 입력하세요.",
  };
  const errorMsg = searchParams.error ? errorMessages[searchParams.error] || `오류: ${searchParams.error}` : null;
  const successMsg = searchParams.connected === "true" ? "Strava 연동이 완료되었습니다!" : null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Alert Banner */}
      {errorMsg && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-900/30 border border-green-800 rounded-xl px-4 py-3 text-sm text-green-300">
          {successMsg}
        </div>
      )}

      {/* Header */}
      <h1 className="text-2xl font-bold text-white">관리자 설정</h1>

      {/* Strava Connection Status */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Strava 연동
        </h2>

        <div className="flex items-center gap-3">
          {stravaConnected ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-zinc-300">연결됨</span>
              {tokenExpiryLabel && (
                <span className={`text-zinc-500 ${tokenExpiryLabel === "만료됨" ? "text-red-400" : ""}`}>
                  · {tokenExpiryLabel}
                </span>
              )}
            </div>
          ) : stravaConfigured ? (
            <a
              href="/api/strava/auth?state=admin"
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-400" />
              연동 필요
            </a>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
              API 키 설정 필요
            </div>
          )}
        </div>

        {/* Webhook */}
        {stravaConnected && (
          <div className="pt-3 border-t border-zinc-800">
            <WebhookStatus
              initialActive={!!siteSettings?.stravaWebhookId}
              initialSubscriptionId={siteSettings?.stravaWebhookId ?? null}
            />
          </div>
        )}

        {/* Sync */}
        {stravaConnected && (
          <div className="pt-3 border-t border-zinc-800">
            <SyncButton
              rideCount={rideCount}
              lastSyncedAt={siteSettings?.lastSyncedAt?.toISOString() ?? null}
            />
          </div>
        )}
      </section>

      {/* Strava API Settings */}
      <StravaSettings
        initialClientId={siteSettings?.stravaClientId ?? ""}
        initialSecretMasked={siteSettings?.stravaClientSecret ? "••••••••" : ""}
        stravaConnected={stravaConnected}
      />

      {/* Quick Links */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          바로가기
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/rides"
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
          >
            라이드 관리
          </Link>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
          >
            사이트 보기 ↗
          </a>
        </div>
      </section>
    </div>
  );
}
