"use client";

import { useState } from "react";

interface MediaItem {
  id: string;
  type: string;
  url: string;
  title: string;
}

interface Props {
  rideId: string;
  initialMedia: MediaItem[];
}

const TYPE_LABELS: Record<string, string> = {
  YOUTUBE: "▶ YouTube",
  INSTAGRAM: "📷 Instagram",
  STRAVA_ACTIVITY: "🚲 Strava",
};

export default function MediaManager({ rideId, initialMedia }: Props) {
  const [mediaList, setMediaList] = useState<MediaItem[]>(initialMedia);
  const [newType, setNewType] = useState<string>("YOUTUBE");
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError("");

    const res = await fetch(`/api/admin/rides/${rideId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType, url: newUrl, title: newTitle }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.media) {
      setMediaList((prev) => [
        ...prev,
        {
          id: data.media.id,
          type: data.media.type,
          url: data.media.url,
          title: data.media.title ?? "",
        },
      ]);
      setNewUrl("");
      setNewTitle("");
    } else {
      setAddError(data.error ?? "추가 실패");
    }

    setAdding(false);
  }

  async function handleDelete(mediaId: string) {
    if (!confirm("미디어를 삭제하시겠습니까?")) return;
    setDeletingId(mediaId);

    const res = await fetch(
      `/api/admin/rides/${rideId}/media?mediaId=${mediaId}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
    } else {
      alert("삭제 실패");
    }

    setDeletingId(null);
  }

  return (
    <div className="space-y-5">
      {/* 기존 미디어 목록 */}
      {mediaList.length === 0 ? (
        <p className="text-zinc-500 text-sm">등록된 미디어가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {mediaList.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 bg-zinc-800/50 rounded-lg p-3"
            >
              <span className="text-xs text-zinc-400 shrink-0 mt-0.5">
                {TYPE_LABELS[m.type] ?? m.type}
              </span>
              <div className="flex-1 min-w-0">
                {m.title && (
                  <p className="text-xs text-zinc-300 truncate mb-0.5">{m.title}</p>
                )}
                <p className="text-xs text-zinc-500 truncate">{m.url}</p>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                disabled={deletingId === m.id}
                className="text-red-400 hover:text-red-300 disabled:opacity-50 text-xs shrink-0 transition-colors"
              >
                {deletingId === m.id ? "…" : "삭제"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 새 미디어 추가 폼 */}
      <form onSubmit={handleAdd} className="space-y-3 border-t border-zinc-700 pt-4">
        <p className="text-xs text-zinc-400 font-medium">미디어 추가</p>

        <div className="flex gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-strava"
          >
            <option value="YOUTUBE">YouTube</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="STRAVA_ACTIVITY">Strava</option>
          </select>

          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="제목 (선택)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-strava"
          />
        </div>

        <div className="flex gap-2">
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            required
            placeholder="URL"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-strava"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-strava hover:bg-strava/90 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded transition-colors whitespace-nowrap"
          >
            {adding ? "추가 중…" : "추가"}
          </button>
        </div>

        {addError && <p className="text-red-400 text-xs">{addError}</p>}
      </form>
    </div>
  );
}
