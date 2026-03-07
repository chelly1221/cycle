import { NextRequest, NextResponse } from "next/server";
import { isAuthedRequest } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

// Extension whitelist — only allow safe image extensions
const SAFE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif"]);

// Magic bytes signatures for image formats
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  "image/avif": [], // AVIF uses ftyp box — check below
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures || signatures.length === 0) {
    // For AVIF, check for ftyp box
    if (mimeType === "image/avif") {
      return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
    }
    return true;
  }
  return signatures.some((sig) =>
    sig.every((byte, i) => buffer.length > i && buffer[i] === byte)
  );
}

export async function POST(req: NextRequest) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate magic bytes match declared MIME type
  if (!validateMagicBytes(buffer, file.type)) {
    return NextResponse.json({ error: "File content does not match declared type" }, { status: 400 });
  }

  // Use SHA-256 instead of MD5 for hashing
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  // Extract and validate extension from whitelist
  const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
  const ext = SAFE_EXTENSIONS.has(rawExt) ? rawExt : "jpg";
  const filename = `${Date.now()}-${hash}.${ext}`;

  // Path traversal protection
  const targetPath = path.resolve(UPLOAD_DIR, filename);
  if (!targetPath.startsWith(path.resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(targetPath, buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { urls } = body;
  if (!Array.isArray(urls)) {
    return NextResponse.json({ error: "urls array required" }, { status: 400 });
  }

  for (const url of urls) {
    if (typeof url !== "string") continue;
    const filename = url.replace(/^\/uploads\//, "");
    if (!/^[\w\-]+\.\w+$/.test(filename)) continue;
    const filepath = path.resolve(UPLOAD_DIR, filename);
    if (!filepath.startsWith(path.resolve(UPLOAD_DIR))) continue;
    await unlink(filepath).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
