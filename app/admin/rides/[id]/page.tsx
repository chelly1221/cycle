import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import RideEditForm from "./RideEditForm";
import MediaManager from "./MediaManager";

export const dynamic = "force-dynamic";

export default async function AdminRideEditPage({
  params,
}: {
  params: { id: string };
}) {
  const ride = await db.ride.findUnique({
    where: { id: params.id },
    include: { media: { orderBy: { sortOrder: "asc" } } },
  });

  if (!ride) notFound();

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <Link href="/admin/rides" className="text-zinc-400 hover:text-white text-sm transition-colors">
          ← 목록으로
        </Link>
        <h1 className="text-2xl font-bold text-white truncate">{ride.name}</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 기본 정보 편집 */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200">기본 정보</h2>
          <RideEditForm
            id={ride.id}
            initialName={ride.name}
            initialCountry={ride.country ?? ""}
            initialStory={ride.story ?? ""}
            initialDescription={ride.description ?? ""}
          />
        </section>

        {/* 미디어 관리 */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200">미디어</h2>
          <MediaManager
            rideId={ride.id}
            initialMedia={ride.media.map((m) => ({
              id: m.id,
              type: m.type,
              url: m.url,
              title: m.title ?? "",
            }))}
          />
        </section>
      </div>

      {/* 메타 정보 (읽기 전용) */}
      <section className="text-xs text-zinc-500 space-y-1">
        <p>ID: {ride.id}</p>
        <p>Strava ID: {ride.stravaId.toString()}</p>
        <p>슬러그: {ride.slug}</p>
        <p>
          시작:{" "}
          {ride.startedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
        </p>
        <p>
          거리: {(ride.distanceM / 1000).toFixed(2)} km · 상승:{" "}
          {Math.round(ride.elevationM)} m
        </p>
      </section>
    </div>
  );
}
