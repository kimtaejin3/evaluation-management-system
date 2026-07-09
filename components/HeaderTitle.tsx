"use client";

import { usePathname } from "next/navigation";
import StatusBadge, { type SessionStatus } from "@/components/StatusBadge";

type Sess = { id: string; name: string; status?: string };

const EXACT: Record<string, string> = {
  "/admin/sessions": "분과 관리",
  "/admin/sessions/new": "새 분과 등록",
  "/admin/evaluators": "평가위원 관리",
  "/admin/companies": "기업 관리",
  "/evaluate": "평가 대상",
};

function resolve(pathname: string): string {
  if (EXACT[pathname]) return EXACT[pathname];
  if (pathname.startsWith("/evaluate/")) return "평가 입력";
  return "심사·평가 종합관리시스템";
}

export default function HeaderTitle({ sessions = [] }: { sessions?: Sess[] }) {
  const pathname = usePathname();

  // 분과 페이지: 분과 이름 + 상태 배지 (탭 이름은 각 페이지 헤더에서 표시)
  const m = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  const session = m && m[1] !== "new" ? sessions.find((s) => s.id === m[1]) : undefined;
  if (session) {
    return (
      <span className="flex items-center gap-2 text-base font-semibold text-slate-800">
        {session.name}
        {session.status && <StatusBadge status={session.status as SessionStatus} />}
      </span>
    );
  }

  return <span className="text-base font-semibold text-slate-800">{resolve(pathname)}</span>;
}
