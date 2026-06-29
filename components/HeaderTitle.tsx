"use client";

import { usePathname } from "next/navigation";

const EXACT: Record<string, string> = {
  "/admin/sessions": "분과 관리",
  "/admin/sessions/new": "새 분과 등록",
  "/admin/evaluators": "평가위원 관리",
  "/admin/companies": "기업 관리",
  "/evaluate": "평가 대상",
};

// /admin/sessions/[id]/<suffix> → 라벨
const SESSION_SUFFIX: Record<string, string> = {
  "": "분과 상세",
  criteria: "평가 항목",
  subjects: "평가 대상",
  evaluators: "평가위원",
  progress: "진행 현황",
  results: "집계 결과",
  breakdown: "산출 근거",
};

function resolve(pathname: string, sessions: { id: string; name: string }[]): string {
  if (EXACT[pathname]) return EXACT[pathname];

  const m = pathname.match(/^\/admin\/sessions\/([^/]+)(?:\/([^/]+))?/);
  if (m && m[1] !== "new") {
    const suffix = m[2] ?? "";
    const label = SESSION_SUFFIX[suffix] ?? "분과 상세";
    const name = sessions.find((s) => s.id === m[1])?.name;
    // 예: "2026 상반기 사업 평가 · 분과 상세"
    return name ? `${name} · ${label}` : label;
  }

  if (pathname.startsWith("/evaluate/")) return "평가 입력";

  return "심사·평가 종합관리시스템";
}

export default function HeaderTitle({ sessions = [] }: { sessions?: { id: string; name: string }[] }) {
  const pathname = usePathname();
  return (
    <span className="text-base font-semibold text-slate-800">
      {resolve(pathname, sessions)}
    </span>
  );
}
