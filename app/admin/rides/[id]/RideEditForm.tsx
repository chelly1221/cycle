"use client";

import { useState } from "react";

interface Props {
  id: string;
  initialName: string;
  initialCountry: string;
  initialStory: string;
  initialDescription: string;
}

export default function RideEditForm({
  id,
  initialName,
  initialCountry,
  initialStory,
  initialDescription,
}: Props) {
  const [name, setName] = useState(initialName);
  const [country, setCountry] = useState(initialCountry);
  const [story, setStory] = useState(initialStory);
  const [description, setDescription] = useState(initialDescription);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrMsg("");

    const res = await fetch(`/api/admin/rides/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, country, story, description }),
    });

    if (res.ok) {
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setErrMsg(data.error ?? "저장 실패");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-strava"
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">국가</label>
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-strava"
          placeholder="South Korea"
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">설명 (짧은 요약)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-strava resize-y"
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">스토리 (긴 글)</label>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={10}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-strava resize-y font-mono"
          placeholder="라이드에 대한 이야기를 적어주세요…"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="bg-strava hover:bg-strava/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded transition-colors"
        >
          {status === "saving" ? "저장 중…" : "저장"}
        </button>
        {status === "ok" && (
          <span className="text-green-400 text-sm">저장 완료!</span>
        )}
        {status === "error" && (
          <span className="text-red-400 text-sm">{errMsg}</span>
        )}
      </div>
    </form>
  );
}
