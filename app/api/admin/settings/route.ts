import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function isAuthed(req: NextRequest): boolean {
  const cookie = req.cookies.get("admin_auth")?.value;
  const pass = process.env.ADMIN_PASSWORD;
  return !!pass && cookie === pass;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.siteSettings.findUnique({
    where: { id: "default" },
  });

  return NextResponse.json({
    stravaClientId: settings?.stravaClientId ?? "",
    stravaClientSecret: settings?.stravaClientSecret ? "••••••••" : "",
  });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { stravaClientId, stravaClientSecret } = body;

  // Build update data — skip secret if empty (masked placeholder)
  const data: Record<string, string> = {};
  if (typeof stravaClientId === "string") data.stravaClientId = stravaClientId;
  if (typeof stravaClientSecret === "string" && stravaClientSecret !== "") {
    data.stravaClientSecret = stravaClientSecret;
  }

  const settings = await db.siteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  return NextResponse.json({
    ok: true,
    stravaClientId: settings.stravaClientId ?? "",
    stravaClientSecret: settings.stravaClientSecret ? "••••••••" : "",
  });
}
