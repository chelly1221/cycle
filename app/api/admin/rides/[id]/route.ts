import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthedRequest } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, story, description, country } = body;

  const data: Record<string, string | undefined> = {};
  if (name !== undefined) data.name = name;
  if (story !== undefined) data.story = story;
  if (description !== undefined) data.description = description;
  if (country !== undefined) data.country = country;

  try {
    const ride = await db.ride.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ ok: true, ride });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.ride.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
