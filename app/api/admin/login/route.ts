import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getExpectedToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const adminId = process.env.ADMIN_ID || "admin";
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let bodyId: string;
  let bodyPassword: string;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    bodyId = (form.get("id") as string) ?? "";
    bodyPassword = (form.get("password") as string) ?? "";
  } else {
    const body = await req.json().catch(() => ({}));
    bodyId = body.id ?? "";
    bodyPassword = body.password ?? "";
  }

  // Use constant-time comparison to prevent timing attacks
  const idMatch =
    bodyId.length === adminId.length &&
    crypto.timingSafeEqual(Buffer.from(bodyId), Buffer.from(adminId));
  const passMatch =
    bodyPassword.length === pass.length &&
    crypto.timingSafeEqual(Buffer.from(bodyPassword), Buffer.from(pass));

  if (!idMatch || !passMatch) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다" },
      { status: 401 }
    );
  }

  const token = getExpectedToken()!;
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_auth", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
  return res;
}
