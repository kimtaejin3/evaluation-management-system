"use client";

import { usePathname } from "next/navigation";
import StatusBadge, { type SessionStatus } from "@/components/StatusBadge";

type Sess = { id: string; name: string; status?: string; projectName?: string | null };
type Proj = { id: string; name: string; status?: string };

const EXACT: Record<string, string> = {
  "/admin/projects": "과제 관리",
  "/admin/projects/new": "새 과제 등록",
  "/admin/sessions": "분과 관리",
  "/admin/sessions/new": "새 분과 등록",
  "/admin/evaluators": "평가위원 · 간사 관리",
  "/admin/companies": "평가 대상 관리",
  "/evaluate": "평가 대상",
};

function resolve(pathname: string): string {
  if (EXACT[pathname]) return EXACT[pathname];
  if (pathname.startsWith("/evaluate/")) return "평가 입력";
  return "심사·평가 종합관리시스템";
}

// 헤더 타이틀 — 조회 중인 과제 이름을 우선 표시한다.
// 과제 페이지: 과제명(+상태), 분과 페이지: 소속 과제명 · 분과명(+상태), 그 외: 고정 라벨.
export default function HeaderTitle({
  sessions = [],
  projects = [],
}: {
  sessions?: Sess[];
  projects?: Proj[];
}) {
  const pathname = usePathname();

  // 과제 하위 페이지: 과제 이름 + 상태 배지.
  // 분과 관리(과제 홈, /admin/projects/[id] 정확 일치)는 본문에 과제명이 크게 있어 헤더에선 생략.
  const pm = pathname.match(/^\/admin\/projects\/([^/]+)/);
  const project = pm && pm[1] !== "new" ? projects.find((p) => p.id === pm[1]) : undefined;
  if (project && pathname === `/admin/projects/${project.id}`) {
    return <span className="text-base font-semibold text-slate-800">과제 관리</span>;
  }
  if (project) {
    return (
      <span className="flex items-center gap-2 text-base font-semibold text-slate-800">
        {project.name}
        {project.status && <StatusBadge status={project.status as SessionStatus} />}
      </span>
    );
  }

  // 분과 페이지: 소속 과제명 · 분과명 + 상태 배지 (탭 이름은 각 페이지 헤더에서 표시)
  const m = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  const session = m && m[1] !== "new" ? sessions.find((s) => s.id === m[1]) : undefined;
  if (session) {
    return (
      <span className="flex items-center gap-2 text-base font-semibold text-slate-800">
        {session.projectName && (
          <>
            <span className="text-slate-500">{session.projectName}</span>
            <span className="text-slate-300" aria-hidden>·</span>
          </>
        )}
        {session.name}
        {session.status && <StatusBadge status={session.status as SessionStatus} />}
      </span>
    );
  }

  return <span className="text-base font-semibold text-slate-800">{resolve(pathname)}</span>;
}
