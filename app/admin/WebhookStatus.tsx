"use client";

import { useState } from "react";

interface Props {
  initialActive: boolean;
  initialSubscriptionId: number | null;
}

export default function WebhookStatus({ initialActive, initialSubscriptionId }: Props) {
  const [active, setActive] = useState(initialActive);
  const [subId, setSubId] = useState(initialSubscriptionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle() {
    setLoading(true);
    setError("");

    try {
      if (active) {
        // Deactivate
        const res = await fetch("/api/strava/webhook/subscribe", { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "삭제 실패");
        setActive(false);
        setSubId(null);
      } else {
        // Activate
        const res = await fetch("/api/strava/webhook/subscribe", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || "구독 생성 실패");
        setActive(true);
        setSubId(data.subscriptionId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${active ? "bg-green-400" : "bg-zinc-600"}`}
        />
        <span className="text-sm text-zinc-300">
          {active ? "웹훅 활성" : "웹훅 비활성"}
        </span>
        {active && subId && (
          <span className="text-xs text-zinc-500">#{subId}</span>
        )}
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className={`text-xs font-medium px-3 py-1 rounded transition-colors disabled:opacity-50 ${
          active
            ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
            : "bg-green-800/50 hover:bg-green-800 text-green-300"
        }`}
      >
        {loading ? "처리 중…" : active ? "비활성화" : "활성화"}
      </button>

      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
