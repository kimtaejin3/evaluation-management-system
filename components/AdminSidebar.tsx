"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, SessionsIcon, UsersIcon } from "./icons";

const APP_VERSION = "0.1.0";

const SUB_ITEMS = [
  { suffix: "", label: "상세" },
  { suffix: "/criteria", label: "평가 항목" },
  { suffix: "/subjects", label: "평가 대상" },
  { suffix: "/evaluators", label: "평가위원" },
  { suffix: "/progress", label: "진행 현황" },
  { suffix: "/results", label: "집계 결과" },
  { suffix: "/breakdown", label: "산출 근거" },
] as const;

function topCls(active: boolean) {
  return `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
    active
      ? "bg-white/10 text-white font-semibold"
      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
  }`;
}
function subCls(active: boolean, disabled = false) {
  return `flex w-full items-center rounded px-3 py-1.5 text-left text-sm transition ${
    disabled
      ? "cursor-pointer text-slate-500 hover:text-slate-300"
      : active
        ? "text-white font-semibold"
        : "text-slate-400 hover:text-white"
  }`;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const m = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  const sid = m && m[1] !== "new" ? m[1] : null;

  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const notifyNoSession = () => {
    setToast(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(false), 2800);
  };

  const isExact = (p: string) => pathname === p;
  const subActive = (suffix: string) =>
    sid
      ? suffix === ""
        ? isExact(`/admin/sessions/${sid}`)
        : pathname.startsWith(`/admin/sessions/${sid}${suffix}`)
      : false;

  const sessionsActive = pathname.startsWith("/admin/sessions");

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-[var(--gov-navy)] text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <div>
          <div className="text-sm font-bold leading-tight">심사·평가</div>
          <div className="text-[11px] text-slate-400">종합관리시스템</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <Link href="/admin" className={topCls(isExact("/admin"))}>
          <DashboardIcon />
          대시보드
        </Link>
        <div>
          <Link href="/admin/sessions" className={topCls(sessionsActive)}>
            <SessionsIcon />
            회차 관리
          </Link>
          <div className="mt-1 ml-3 space-y-0.5 border-l border-white/15 pl-2">
            {SUB_ITEMS.map((it) =>
              sid ? (
                <Link
                  key={it.suffix}
                  href={`/admin/sessions/${sid}${it.suffix}`}
                  className={subCls(subActive(it.suffix))}
                >
                  <span className="mr-1 text-white/30">└</span>
                  {it.label}
                </Link>
              ) : (
                <button
                  key={it.suffix}
                  type="button"
                  onClick={notifyNoSession}
                  className={subCls(false, true)}
                >
                  <span className="mr-1 text-white/20">└</span>
                  {it.label}
                </button>
              ),
            )}
          </div>
        </div>
        <Link
          href="/admin/evaluators"
          className={topCls(pathname.startsWith("/admin/evaluators"))}
        >
          <UsersIcon />
          평가위원 관리
        </Link>
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">
        심사·평가 종합관리시스템{" "}
        <span className="text-slate-400">v{APP_VERSION}</span>
      </div>

      {/* 회차 미선택 안내 토스트 */}
      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900/95 px-4 py-2.5 text-sm text-slate-100">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4 text-[var(--gov-primary)]"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path
              d="M12 8h.01M11 12h1v4h1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          먼저 회차 관리에서 회차를 선택해주세요.
        </div>
      </div>
    </aside>
  );
}
