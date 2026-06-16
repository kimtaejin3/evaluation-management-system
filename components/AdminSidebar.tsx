"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionsIcon, UsersIcon, CompanyIcon } from "./icons";

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
function sessionCls(active: boolean) {
  return `block truncate rounded px-3 py-1.5 text-sm transition ${
    active ? "bg-white/10 text-white font-semibold" : "text-slate-400 hover:text-white"
  }`;
}
function leafCls(active: boolean) {
  return `block rounded px-3 py-1 text-[13px] transition ${
    active ? "text-white font-semibold" : "text-slate-400 hover:text-white"
  }`;
}

export default function AdminSidebar({ sessions }: { sessions: { id: string; name: string }[] }) {
  const pathname = usePathname();
  const m = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  const sid = m && m[1] !== "new" ? m[1] : null;

  const isExact = (p: string) => pathname === p;
  const sessionsActive = pathname === "/admin/sessions" || pathname === "/admin/sessions/new";
  const leafActive = (suffix: string) =>
    suffix === ""
      ? isExact(`/admin/sessions/${sid}`)
      : pathname.startsWith(`/admin/sessions/${sid}${suffix}`);

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-[var(--gov-navy)] text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <div>
          <div className="text-sm font-bold leading-tight">심사·평가</div>
          <div className="text-[11px] text-slate-400">종합관리시스템</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <div>
          <Link href="/admin/sessions" className={topCls(sessionsActive)}>
            <SessionsIcon />
            심사 관리
          </Link>
          {/* 심사 리스트 */}
          <div className="mt-1 ml-3 space-y-0.5 border-l border-white/15 pl-2">
            {sessions.length === 0 && (
              <div className="px-3 py-1.5 text-xs text-slate-500">등록된 심사 없음</div>
            )}
            {sessions.map((s) => {
              const active = s.id === sid;
              return (
                <div key={s.id}>
                  <Link href={`/admin/sessions/${s.id}`} className={sessionCls(active)} title={s.name}>
                    {s.name}
                  </Link>
                  {active && (
                    <div className="mt-0.5 ml-3 space-y-0.5 border-l border-white/10 pl-2">
                      {SUB_ITEMS.map((it) => (
                        <Link
                          key={it.suffix}
                          href={`/admin/sessions/${s.id}${it.suffix}`}
                          className={leafCls(leafActive(it.suffix))}
                        >
                          {it.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Link href="/admin/evaluators" className={topCls(pathname.startsWith("/admin/evaluators"))}>
          <UsersIcon />
          평가위원 관리
        </Link>
        <Link href="/admin/companies" className={topCls(pathname.startsWith("/admin/companies"))}>
          <CompanyIcon />
          기업 관리
        </Link>
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">
        심사·평가 종합관리시스템 <span className="text-slate-400">v{APP_VERSION}</span>
      </div>
    </aside>
  );
}
