"use client";

import { useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import dynamicImport from "next/dynamic";

const RichEditor = dynamicImport(() => import("@/components/editor/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] bg-gray-950 border border-gray-700 rounded-lg animate-pulse" />
  ),
});

interface Props {
  rideSlug: string;
  initialStory: string | null;
  isLoggedIn: boolean;
  label: string;
}

/** Detect plain text (no HTML tags) and convert to paragraphs */
function plainTextToHtml(text: string): string {
  if (!text || text.includes("<")) return text;
  return text
    .split("\n\n")
    .filter((p) => p.trim())
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default function ReviewEditor({ rideSlug, initialStory, isLoggedIn, label }: Props) {
  const [editing, setEditing] = useState(false);
  const htmlStory = plainTextToHtml(initialStory ?? "");
  const [content, setContent] = useState(htmlStory);
  const [saved, setSaved] = useState(htmlStory);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/rides/${rideSlug}/story`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: content, uploadedUrls }),
      });
      if (res.ok) {
        setSaved(content);
        setUploadedUrls([]);
        setEditing(false);
      } else {
        setError("저장에 실패했습니다. 다시 시도해주세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    // Delete images uploaded during this session (all are orphans on cancel)
    if (uploadedUrls.length > 0) {
      fetch("/api/uploads/image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: uploadedUrls }),
      }).catch(() => {});
    }
    setContent(saved);
    setUploadedUrls([]);
    setEditing(false);
    setError("");
  }

  const isEmpty = !saved || saved === "<p></p>";

  // Not logged in — show story read-only (or nothing if empty)
  if (!isLoggedIn) {
    if (isEmpty) return null;
    return (
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div
          className="story-content text-gray-400 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(saved) }}
        />
      </div>
    );
  }

  // Logged in — edit mode
  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">{label}</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-white bg-strava hover:bg-strava/90 disabled:opacity-50 transition-colors px-3 py-1.5 rounded font-medium"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
        <RichEditor
          content={content}
          onChange={setContent}
          onUpload={(url) => setUploadedUrls((prev) => [...prev, url])}
        />
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  // Logged in — display mode with edit button
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{label}</h2>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {isEmpty ? "후기 작성" : "수정"}
        </button>
      </div>
      {isEmpty ? (
        <p className="text-gray-600 italic text-sm">아직 작성된 후기가 없습니다.</p>
      ) : (
        <div
          className="story-content text-gray-400 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(saved) }}
        />
      )}
    </div>
  );
}
