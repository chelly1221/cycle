"use client";

import { useState } from "react";

interface Props {
  initialClientId: string;
  initialSecretMasked: string;
  stravaConnected: boolean;
}

export default function StravaSettings({
  initialClientId,
  initialSecretMasked,
  stravaConnected,
}: Props) {
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState("");
  const [secretSaved, setSecretSaved] = useState(!!initialSecretMasked);
  const [editingSecret, setEditingSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!initialClientId && !!initialSecretMasked);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stravaClientId: clientId,
          stravaClientSecret: clientSecret || "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSecretSaved(!!data.stravaClientSecret);
      setSaved(!!data.stravaClientId && !!data.stravaClientSecret);
      setEditingSecret(false);
      setClientSecret("");
      setMessage({ type: "ok", text: "저장 완료" });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "저장 실패" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
        Strava API 설정
      </h2>
      <div className="space-y-4">
        {/* Client ID */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="12345"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Client Secret */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Client Secret</label>
          {secretSaved && !editingSecret ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 font-mono tracking-widest">
                {"••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setEditingSecret(true)}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline"
              >
                변경
              </button>
            </div>
          ) : (
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={secretSaved ? "새 시크릿 입력" : "시크릿 입력"}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          )}
        </div>

        {/* Save button + message */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {message && (
            <span
              className={`text-xs ${message.type === "ok" ? "text-green-400" : "text-red-400"}`}
            >
              {message.text}
            </span>
          )}
        </div>

        {/* OAuth Connect Button */}
        {saved && !stravaConnected && (
          <div className="pt-2 border-t border-zinc-800">
            <a
              href="/api/strava/auth?state=admin"
              className="inline-flex items-center gap-2 bg-[#fc4c02] hover:bg-[#e34402] text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Strava 계정 연동하기
            </a>
            <p className="text-xs text-zinc-500 mt-2">
              저장된 API 키로 Strava OAuth 인증을 시작합니다.
            </p>
          </div>
        )}

        {saved && stravaConnected && (
          <div className="pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Strava 연동 완료 — 위 동기화 버튼으로 라이드를 가져오세요.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
