"use client";

export default function LogoutButton() {
  return (
    <button
      onClick={() => {
        window.location.href = "/api/logout";
      }}
      className="text-zinc-400 hover:text-white transition-colors text-sm"
    >
      로그아웃
    </button>
  );
}
