import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const ride = await db.ride.findUnique({
    where: { slug: params.slug },
    select: {
      media: {
        select: { id: true, type: true, url: true, title: true, thumbnailUrl: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  return NextResponse.json({ media: ride?.media ?? [] })
}
