import dynamicImport from "next/dynamic";
import Link from "next/link";
import { db } from "@/lib/db";
import { getGlobalStats, getYearlyStats, getCountryBreakdown, getTopClimbs } from "@/lib/stats";
import SyncButton from "./SyncButton";
import WebhookStatus from "./WebhookStatus";
import StravaSettings from "./StravaSettings";

export const dynamic = "force-dynamic";

const YearlyChart = dynamicImport(
  () => import("@/components/charts/YearlyChart"),
  { ssr: false }
);

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: { error?: string; connected?: string };
}) {
  const [token, stats, yearlyStats, countryBreakdown, topClimbs, latestRide, siteSettings, rideCount] =
    await Promise.all([
      db.stravaToken.findFirst({ orderBy: { createdAt: "desc" } }),
      getGlobalStats(),
      getYearlyStats(),
      getCountryBreakdown(),
      getTopClimbs(5),
      db.ride.findFirst({
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          name: true,
          country: true,
          countryCode: true,
          startedAt: true,
          distanceM: true,
          elevationM: true,
          movingTimeSec: true,
          type: true,
          averageSpeed: true,
          kudosCount: true,
          story: true,
          _count: { select: { media: true } },
        },
      }),
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

  const statCards = [
    { label: "라이드", value: stats.totalRides.toLocaleString(), unit: "" },
    { label: "거리", value: stats.totalDistanceKm.toLocaleString(), unit: "km" },
    { label: "상승", value: stats.totalElevationM.toLocaleString(), unit: "m" },
    { label: "시간", value: stats.totalMovingHours.toLocaleString(), unit: "h" },
    { label: "국가", value: `${stats.countriesVisited}`, unit: "개국" },
  ];

  const top7Countries = countryBreakdown.slice(0, 7);

  const errorMessages: Record<string, string> = {
    token_exchange: "Strava 인증 실패 — Client ID 또는 Client Secret이 올바르지 않습니다. strava.com/settings/api에서 확인하세요.",
    strava_denied: "Strava 인증이 거부되었습니다.",
    missing_credentials: "Strava API 자격증명이 설정되지 않았습니다. 아래에서 입력하세요.",
  };
  const errorMsg = searchParams.error ? errorMessages[searchParams.error] || `오류: ${searchParams.error}` : null;
  const successMsg = searchParams.connected === "true" ? "Strava 연동이 완료되었습니다!" : null;

  return (
    <div className="space-y-8">
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

      {/* [1] Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">관리자 대시보드</h1>
        <div className="flex items-center gap-3">
          {stravaConnected ? (
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-zinc-300">Strava 연결됨</span>
              {tokenExpiryLabel && (
                <span className={`text-zinc-500 ${tokenExpiryLabel === "만료됨" ? "text-red-400" : ""}`}>
                  · {tokenExpiryLabel}
                </span>
              )}
            </div>
          ) : stravaConfigured ? (
            <a
              href="/api/strava/auth?state=admin"
              className="flex items-center gap-2 bg-zinc-800 border border-red-800/50 rounded-full px-3 py-1 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Strava 연동 필요
            </a>
          ) : (
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
              API 키 설정 필요
            </div>
          )}
          {stravaConnected && (
            <SyncButton
              rideCount={rideCount}
              lastSyncedAt={siteSettings?.lastSyncedAt?.toISOString() ?? null}
            />
          )}
        </div>
      </div>

      {/* Webhook Status */}
      {stravaConnected && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <WebhookStatus
            initialActive={!!siteSettings?.stravaWebhookId}
            initialSubscriptionId={siteSettings?.stravaWebhookId ?? null}
          />
        </div>
      )}

      {/* [1.5] Strava API Settings */}
      <StravaSettings
        initialClientId={siteSettings?.stravaClientId ?? ""}
        initialSecretMasked={siteSettings?.stravaClientSecret ? "••••••••" : ""}
        stravaConnected={stravaConnected}
      />

      {/* [2] Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((c) => (
          <div
            key={c.label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center"
          >
            <p className="text-2xl font-mono font-bold text-white">
              {c.value}
              <span className="text-sm font-normal text-zinc-500 ml-1">{c.unit}</span>
            </p>
            <p className="text-xs text-zinc-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* [3] Latest Ride */}
      {latestRide && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            최근 라이드
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <Link
                href={`/admin/rides/${latestRide.id}/edit`}
                className="text-lg font-semibold text-white hover:text-strava transition-colors"
              >
                {latestRide.name}
              </Link>
              <p className="text-sm text-zinc-400">
                {latestRide.country && (
                  <span>
                    {latestRide.countryCode && (
                      <span className="mr-1">{countryCodeToFlag(latestRide.countryCode)}</span>
                    )}
                    {latestRide.country} ·{" "}
                  </span>
                )}
                {latestRide.startedAt.toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Stat label="거리" value={`${(latestRide.distanceM / 1000).toFixed(1)} km`} />
              <Stat label="상승" value={`${Math.round(latestRide.elevationM)} m`} />
              <Stat label="시간" value={formatDuration(latestRide.movingTimeSec)} />
              {latestRide.averageSpeed != null && (
                <Stat
                  label="평균속도"
                  value={`${(latestRide.averageSpeed * 3.6).toFixed(1)} km/h`}
                />
              )}
              {latestRide.kudosCount > 0 && (
                <Stat label="Kudos" value={String(latestRide.kudosCount)} highlight />
              )}
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className={latestRide._count.media > 0 ? "text-green-400" : "text-zinc-600"}>
                  미디어 {latestRide._count.media}
                </span>
                <span className={latestRide.story ? "text-green-400" : "text-zinc-600"}>
                  스토리 {latestRide.story ? "✓" : "✗"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* [4] Two-column: Yearly Chart + Country Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* [4A] Yearly Chart */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            연도별 거리
          </h2>
          {yearlyStats.length > 0 ? (
            <YearlyChart data={yearlyStats} metric="distanceKm" />
          ) : (
            <p className="text-sm text-zinc-500">데이터 없음</p>
          )}
        </section>

        {/* [4B] Country Table */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            국가별 통계
          </h2>
          {top7Countries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left py-2 font-medium">국가</th>
                    <th className="text-right py-2 font-medium">라이드</th>
                    <th className="text-right py-2 font-medium">거리</th>
                    <th className="text-right py-2 font-medium">상승</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {top7Countries.map((c) => (
                    <tr key={c.country} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2 text-zinc-200">
                        {c.countryCode && (
                          <span className="mr-1.5">{countryCodeToFlag(c.countryCode)}</span>
                        )}
                        {c.country}
                      </td>
                      <td className="py-2 text-right font-mono text-zinc-300">{c.rides}</td>
                      <td className="py-2 text-right font-mono text-zinc-300">
                        {c.distanceKm.toLocaleString()} <span className="text-zinc-500">km</span>
                      </td>
                      <td className="py-2 text-right font-mono text-zinc-300">
                        {c.elevationM.toLocaleString()} <span className="text-zinc-500">m</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">데이터 없음</p>
          )}
        </section>
      </div>

      {/* [5] Top Climbs */}
      {topClimbs.length > 0 && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            상위 클라이밍 Top 5
          </h2>
          <div className="space-y-3">
            {topClimbs.map((climb, i) => (
              <div
                key={climb.id}
                className="flex items-center justify-between gap-4 py-2 border-b border-zinc-800/50 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg font-mono font-bold text-zinc-600 w-6 text-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/rides/${climb.id}/edit`}
                      className="text-sm font-medium text-zinc-200 hover:text-strava transition-colors truncate block"
                    >
                      {climb.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {climb.country} · {climb.startedAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm shrink-0">
                  <span className="font-mono font-bold text-strava">
                    {climb.elevationM.toLocaleString()} m
                  </span>
                  <span className="font-mono text-zinc-400">
                    {climb.distanceKm.toFixed(1)} km
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* [6] Quick Actions */}
      <section>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          빠른 작업
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink href="/admin/rides" label="라이드 관리" icon="📋" />
          <QuickLink href="/" label="사이트 보기" icon="🌐" external />
          <QuickLink href="/en/dashboard" label="공개 대시보드" icon="📊" external />
          <QuickLink href="/en/rides" label="공개 라이드" icon="🚴" external />
        </div>
      </section>
    </div>
  );
}

/* ─── Helper Components ────────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className={`font-mono font-bold ${highlight ? "text-strava" : "text-white"}`}>
        {value}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon,
  external,
}: {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
}) {
  const classes =
    "bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-zinc-700 transition-colors";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        <span className="text-xl block mb-1">{icon}</span>
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="text-xs text-zinc-500 ml-1">↗</span>
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      <span className="text-xl block mb-1">{icon}</span>
      <span className="text-sm text-zinc-300">{label}</span>
    </Link>
  );
}

function countryCodeToFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}
