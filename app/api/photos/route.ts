import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MediaType } from "@prisma/client";

const PAGE_SIZE = 40;

export async function GET(req: NextRequest) {
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  const photos = await db.media.findMany({
    where: { type: MediaType.STRAVA_PHOTO },
    include: {
      ride: {
        select: {
          name: true,
          slug: true,
          country: true,
          startedAt: true,
        },
      },
    },
    orderBy: [{ ride: { startedAt: "desc" } }, { sortOrder: "asc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = photos.length > PAGE_SIZE;
  const items = hasMore ? photos.slice(0, PAGE_SIZE) : photos;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id,
      url: p.url,
      thumbnailUrl: p.thumbnailUrl,
      title: p.title,
      rideName: p.ride.name,
      rideSlug: p.ride.slug,
      country: p.ride.country,
      countrySlug: p.ride.country?.toLowerCase().replace(/\s+/g, "-") ?? "",
      date: p.ride.startedAt.toISOString().split("T")[0],
    })),
    nextCursor,
  });
}
