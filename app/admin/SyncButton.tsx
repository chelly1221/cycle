"use client";

import { useState } from "react";

interface Props {
  rideCount: number;
  lastSyncedAt: string | null; // ISO string or null
}

export default function SyncButton({ rideCount, lastSyncedAt }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ synced: number; errors: number } | null>(null);
  const [errMsg, setErrMsg] = useState("");

  async function handleSync(mode: "incremental" | "full") {
    setStatus("loading");
    setResult(null);
    setErrMsg("");

    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrMsg(data.error ?? "동기화 실패");
        setStatus("error");
      } else {
        setResult({ synced: data.synced, errors: data.errors });
        setStatus("done");
      }
    } catch (e) {
      setErrMsg(String(e));
      setStatus("error");
    }
  }

  const isInitial = rideCount === 0;

  const spinner = (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {isInitial ? (
          <button
            onClick={() => handleSync("full")}
            disabled={status === "loading"}
            className="bg-strava hover:bg-strava/90 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded transition-colors"
          >
            {status === "loading" ? (
              <span className="flex items-center gap-2">{spinner} 전체 동기화 중…</span>
            ) : (
              "Strava 전체 동기화"
            )}
          </button>
        ) : (
          <>
            <button
              onClick={() => handleSync("incremental")}
              disabled={status === "loading"}
              className="bg-strava hover:bg-strava/90 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded transition-colors"
            >
              {status === "loading" ? (
                <span className="flex items-center gap-2">{spinner} 동기화 중…</span>
              ) : (
                "동기화"
              )}
            </button>
            <button
              onClick={() => handleSync("full")}
              disabled={status === "loading"}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
            >
              전체 재동기화
            </button>
          </>
        )}

        {status === "done" && result && (
          <span className="text-sm text-green-400">
            {result.synced > 0
              ? `${result.synced}개 동기화${result.errors > 0 ? `, ${result.errors}개 오류` : ""}`
              : "최신 상태"}
          </span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-400">{errMsg}</span>
        )}
      </div>

      {lastSyncedAt && (
        <p className="text-xs text-zinc-500">
          마지막 동기화: {new Date(lastSyncedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
        </p>
      )}
    </div>
  );
}
