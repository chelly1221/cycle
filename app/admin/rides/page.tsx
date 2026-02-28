import Link from "next/link";
import { db } from "@/lib/db";
import DeleteRideButton from "./DeleteRideButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminRidesPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = searchParams.q ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const skip = (page - 1) * PAGE_SIZE;

  const where = q
    ? { name: { contains: q, mode: "insensitive" as const } }
    : {};

  const [rides, total] = await Promise.all([
    db.ride.findMany({
      where,
      select: {
        id: true,
        name: true,
        country: true,
        distanceM: true,
        type: true,
        startedAt: true,
      },
      orderBy: { startedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.ride.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/admin/rides?${params}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">라이드 목록</h1>
        <span className="text-sm text-zinc-400">총 {total}개</span>
      </div>

      {/* 검색 */}
      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="이름 검색…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-strava"
        />
        <button
          type="submit"
          className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-4 py-2 rounded transition-colors"
        >
          검색
        </button>
        {q && (
          <a
            href="/admin/rides"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-3 py-2 rounded transition-colors"
          >
            초기화
          </a>
        )}
      </form>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400 border-b border-zinc-800">
              <th className="pb-3 pr-4 font-medium">날짜</th>
              <th className="pb-3 pr-4 font-medium">이름</th>
              <th className="pb-3 pr-4 font-medium">국가</th>
              <th className="pb-3 pr-4 font-medium">거리</th>
              <th className="pb-3 pr-4 font-medium">타입</th>
              <th className="pb-3 font-medium">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {rides.map((ride) => (
              <tr key={ride.id} className="hover:bg-zinc-900/50">
                <td className="py-3 pr-4 text-zinc-400 whitespace-nowrap">
                  {ride.startedAt.toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </td>
                <td className="py-3 pr-4 text-zinc-100 max-w-xs truncate">
                  {ride.name}
                </td>
                <td className="py-3 pr-4 text-zinc-300">{ride.country ?? "—"}</td>
                <td className="py-3 pr-4 text-zinc-300 whitespace-nowrap">
                  {(ride.distanceM / 1000).toFixed(1)} km
                </td>
                <td className="py-3 pr-4 text-zinc-400 text-xs">{ride.type}</td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/rides/${ride.id}`}
                      className="text-strava hover:underline"
                    >
                      수정
                    </Link>
                    <DeleteRideButton id={ride.id} name={ride.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rides.length === 0 && (
          <p className="text-center text-zinc-500 py-12">라이드가 없습니다.</p>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded transition-colors"
            >
              ← 이전
            </Link>
          )}
          <span className="text-zinc-400">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageUrl(page + 1)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded transition-colors"
            >
              다음 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
