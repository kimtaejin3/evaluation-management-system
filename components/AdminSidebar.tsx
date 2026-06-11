"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  SessionsIcon,
  UsersIcon,
  TemplateIcon,
} from "./icons";

function topCls(active: boolean) {
  return `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
    active
      ? "bg-white/10 text-white font-semibold"
      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
  }`;
}
function subCls(active: boolean) {
  return `block rounded px-3 py-1.5 text-sm transition ${
    active ? "text-white font-semibold" : "text-slate-400 hover:text-white"
  }`;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const m = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  const sid = m && m[1] !== "new" ? m[1] : null;

  const isExact = (p: string) => pathname === p;
  const sub = (suffix: string) =>
    sid ? `/admin/sessions/${sid}${suffix}` : "#";

  const sessionItems = sid
    ? [
        {
          href: sub(""),
          label: "상세",
          active: isExact(`/admin/sessions/${sid}`),
        },
        {
          href: sub("/criteria"),
          label: "평가 항목",
          active: pathname.startsWith(`/admin/sessions/${sid}/criteria`),
        },
        {
          href: sub("/subjects"),
          label: "평가 대상",
          active: pathname.startsWith(`/admin/sessions/${sid}/subjects`),
        },
        {
          href: sub("/evaluators"),
          label: "평가위원",
          active: pathname.startsWith(`/admin/sessions/${sid}/evaluators`),
        },
        {
          href: sub("/progress"),
          label: "진행 현황",
          active: pathname.startsWith(`/admin/sessions/${sid}/progress`),
        },
        {
          href: sub("/results"),
          label: "집계 결과",
          active: pathname.startsWith(`/admin/sessions/${sid}/results`),
        },
        {
          href: sub("/breakdown"),
          label: "산출 근거",
          active: pathname.startsWith(`/admin/sessions/${sid}/breakdown`),
        },
      ]
    : [];

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
          {sessionItems.length > 0 && (
            <div className="mt-1 ml-3 space-y-0.5 border-l border-white/15 pl-2">
              {sessionItems.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={subCls(it.active)}
                >
                  <span className="mr-1 text-white/30">└</span>
                  {it.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <Link
          href="/admin/evaluators"
          className={topCls(pathname.startsWith("/admin/evaluators"))}
        >
          <UsersIcon />
          평가위원 관리
        </Link>
        <Link
          href="/admin/templates"
          className={topCls(pathname.startsWith("/admin/templates"))}
        >
          <TemplateIcon />
          항목 템플릿
        </Link>
      </nav>
    </aside>
  );
}
