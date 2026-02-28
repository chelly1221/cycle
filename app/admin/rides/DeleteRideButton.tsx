"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteRideButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`"${name}" 라이드를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`)) {
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/admin/rides/${id}`, { method: "DELETE" });

    if (res.ok) {
      router.refresh();
    } else {
      alert("삭제 실패");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
    >
      {loading ? "…" : "삭제"}
    </button>
  );
}
