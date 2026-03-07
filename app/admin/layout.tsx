import type { ReactNode } from "react";
import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { isAuthedServer } from "@/lib/auth";

export const metadata = { title: "관리자 — Cycle Archive" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  const authed = isAuthedServer();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      {authed && (
        <nav className="sticky top-0 z-50 bg-zinc-900 border-b border-zinc-800">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/admin"
              className="text-strava font-bold tracking-tight hover:opacity-80 transition-opacity"
            >
              관리자
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/admin/rides"
                className="text-zinc-300 hover:text-white transition-colors"
              >
                라이드 목록
              </Link>
              <LogoutButton />
            </div>
          </div>
        </nav>
      )}
      <main className={authed ? "max-w-6xl mx-auto px-4 py-12" : ""}>{children}</main>
    </div>
  );
}
