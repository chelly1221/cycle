import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MediaType } from "@prisma/client";
import { isAuthedRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { type, url, title } = body;

  if (!type || !url || typeof url !== "string") {
    return NextResponse.json({ error: "type and url required" }, { status: 400 });
  }

  // Validate media type against actual enum values
  const ALLOWED_MEDIA_TYPES: string[] = Object.values(MediaType);
  if (!ALLOWED_MEDIA_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }

  // Validate URL format — must be http(s)
  const trimmedUrl = url.trim();
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return NextResponse.json({ error: "URL must start with http:// or https://" }, { status: 400 });
  }

  try {
    const media = await db.media.create({
      data: {
        rideId: params.id,
        type: type as MediaType,
        url: trimmedUrl,
        title: title ?? null,
      },
    });
    return NextResponse.json({ ok: true, media });
  } catch {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  _context: { params: { id: string } }
) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mediaId = searchParams.get("mediaId");

  if (!mediaId) {
    return NextResponse.json({ error: "mediaId required" }, { status: 400 });
  }

  try {
    await db.media.delete({ where: { id: mediaId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
