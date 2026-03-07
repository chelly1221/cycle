import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthedRequest } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Strip dangerous HTML tags/attributes server-side */
function sanitizeHtml(html: string): string {
  return html
    // Remove script tags and contents
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Remove event handlers (onclick, onerror, onload, etc.)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Remove javascript: URLs
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"')
    .replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')
    // Remove data: URLs in src (potential XSS via SVG/HTML)
    .replace(/src\s*=\s*(?:"data:text\/html[^"]*"|'data:text\/html[^']*')/gi, '')
    // Remove iframe, object, embed tags
    .replace(/<(iframe|object|embed|form|input|textarea|button)[\s\S]*?(?:<\/\1>|\/?>)/gi, '');
}

/** Extract /uploads/* URLs from HTML */
function extractUploadUrls(html: string): string[] {
  const matches = html.match(/\/uploads\/[\w\-]+\.\w+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/** Delete orphan upload files from disk */
async function deleteOrphanFiles(orphanUrls: string[]) {
  for (const url of orphanUrls) {
    const filename = url.replace(/^\/uploads\//, "");
    if (!/^[\w\-]+\.\w+$/.test(filename)) continue;
    const filepath = path.resolve(UPLOAD_DIR, filename);
    if (!filepath.startsWith(path.resolve(UPLOAD_DIR))) continue;
    await unlink(filepath).catch(() => {});
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { story, uploadedUrls = [] } = body;

  if (typeof story !== "string") {
    return NextResponse.json({ error: "story required" }, { status: 400 });
  }

  try {
    // Read old story to find previously used images
    const ride = await db.ride.findUnique({
      where: { slug: params.slug },
      select: { story: true },
    });
    const oldUrls = ride?.story ? extractUploadUrls(ride.story) : [];

    // Save new story
    const sanitized = sanitizeHtml(story.trim()) || null;
    await db.ride.update({
      where: { slug: params.slug },
      data: { story: sanitized },
    });

    // Compute orphans: (old images + session uploads) minus images in new story
    const newUrls = new Set(sanitized ? extractUploadUrls(sanitized) : []);
    const validUploaded = Array.isArray(uploadedUrls)
      ? uploadedUrls.filter((u: unknown) => typeof u === "string")
      : [];
    const allPrevious = Array.from(new Set(oldUrls.concat(validUploaded)));
    const orphans = allPrevious.filter((url) => !newUrls.has(url));

    // Delete orphan files (fire-and-forget)
    deleteOrphanFiles(orphans).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
