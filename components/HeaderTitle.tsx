"use client";

import { usePathname } from "next/navigation";
import StatusBadge, { type SessionStatus } from "@/components/StatusBadge";

type Sess = { id: string; name: string; status?: string; projectName?: string | null };
type Proj = { id: string; name: string; status?: string };

const EXACT: Record<string, string> = {
  "/admin/projects": "사업 관리",
  "/admin/projects/new": "사업 등록",
  "/admin/sessions": "분과 관리",
  "/admin/sessions/new": "새 분과 등록",
  "/admin/secretaries": "담당자 관리",
  "/admin/secretaries/new": "새 담당자 등록",
  "/admin/evaluators": "평가위원 관리",
  "/admin/evaluators/new": "새 평가위원 등록",
  "/admin/companies": "평가 대상 관리",
  "/evaluate": "평가 대상",
};

function resolve(pathname: string): string {
  if (EXACT[pathname]) return EXACT[pathname];
  if (pathname.startsWith("/evaluate/")) return "평가 입력";
  return "심사·평가 종합관리시스템";
}

// 헤더 타이틀 — 조회 중인 사업 이름을 우선 표시한다.
// 사업 페이지: 사업명(+상태), 분과 페이지: 소속 사업명 · 분과명(+상태), 그 외: 고정 라벨.
export default function HeaderTitle({
  sessions = [],
  projects = [],
}: {
  sessions?: Sess[];
  projects?: Proj[];
}) {
  const pathname = usePathname();

  // 사업 하위 페이지: 사업 이름 + 상태 배지.
  // 사업 홈(사업 담당자 설정, /admin/projects/[id] 정확 일치)은 본문에 사업 제목이 크게 있어 헤더는 비운다.
  const pm = pathname.match(/^\/admin\/projects\/([^/]+)/);
  const project = pm && pm[1] !== "new" ? projects.find((p) => p.id === pm[1]) : undefined;
  if (project && pathname === `/admin/projects/${project.id}`) {
    return null;
  }
  if (project) {
    return (
      <span className="flex items-center gap-2 text-base font-semibold text-slate-800">
        {project.name}
        {project.status && <StatusBadge status={project.status as SessionStatus} />}
      </span>
    );
  }

  // 분과 페이지: 소속 사업명 · 분과명 + 상태 배지 (현재 위치 경로는 헤더 아래 AdminBreadcrumb에서)
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
