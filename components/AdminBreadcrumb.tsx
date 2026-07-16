"use client";

import { usePathname } from "next/navigation";
import { SESSION_TAB_LABEL } from "@/lib/session-nav";

type Sess = { id: string; name: string; projectName?: string | null };

// 헤더 UI 바로 아래에 표시되는 현재 위치(PWD) 경로 — 어느 과제 / 어느 분과 / 무슨 화면.
// 관리자(MASTER) 전용: 간사에게는 렌더하지 않는다. 분과 상세 경로에서만 표시.
export default function AdminBreadcrumb({
  sessions = [],
  role = "SECRETARY",
}: {
  sessions?: Sess[];
  role?: "MASTER" | "SECRETARY";
}) {
  const pathname = usePathname();
  if (role !== "MASTER") return null;

  const m = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  const session = m && m[1] !== "new" ? sessions.find((s) => s.id === m[1]) : undefined;
  if (!session) return null;

  const suffix = pathname.slice(`/admin/sessions/${session.id}`.length);
  const tab = SESSION_TAB_LABEL[suffix];

  return (
    <div className="border-b border-slate-200 bg-slate-50/60 px-8 py-1.5 text-xs text-slate-500">
      {session.projectName ?? "미분류"} <span className="text-slate-300">/</span> {session.name}
      {tab && (
        <>
          {" "}
          <span className="text-slate-300">/</span> {tab}
        </>
      )}
    </div>
  );
}
