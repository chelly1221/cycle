import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.password !== pass) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_auth", pass, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    // no maxAge = session cookie
  });
  return res;
}

export async function GET() {
  const res = NextResponse.redirect(
    new URL("/admin/login", process.env.NEXT_PUBLIC_BASE_URL ?? "https://cycle.3chan.kr")
  );
  res.cookies.set("admin_auth", "", { maxAge: 0, path: "/" });
  return res;
}
