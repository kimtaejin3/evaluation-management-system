"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SESSION_TAB_LABEL } from "@/lib/session-nav";
import { PROJECT_TAB_LABEL } from "@/lib/project-nav";

type Sess = { id: string; name: string; projectId?: string | null; projectName?: string | null };

// 분과 화면 접미사 → 진입한 사업 화면 접미사 매핑(기능 경로의 상위 단계)
const PARENT_SUFFIX: Record<string, string> = {
  "": "/monitoring",
  "/criteria": "/criteria",
  "/subjects": "/subjects",
  "/evaluators": "/evaluators",
  "/opinions": "/opinions",
  "/results": "/results",
  "/progress": "/monitoring",
  "/breakdown": "/results",
};

// 분과 화면의 기능 경로 이름 — 사업 화면과 구분되게 '분과 ○○'로 표기
const CHILD_LABEL: Record<string, string> = {
  "": "분과 실시간 진행 상황",
  "/criteria": "분과 평가 항목",
  "/subjects": "분과 평가 대상",
  "/evaluators": "분과 평가위원 현황",
  "/opinions": "분과 평가 의견서",
  "/results": "분과 집계 결과",
  "/progress": "상세 평가 진행 상황",
  "/breakdown": "세부 집계 현황",
};

// 헤더 바로 아래의 현재 위치 표시 — 사업/분과 '이름'(제목으로 이미 보임) 대신
// 기능 경로를 보여준다. 예: 집계 결과 › 분과 집계 결과. 관리자(MASTER) 전용.
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
  const parentSuffix = PARENT_SUFFIX[suffix];
  const parentLabel = parentSuffix !== undefined ? PROJECT_TAB_LABEL[parentSuffix] : undefined;
  const childLabel = CHILD_LABEL[suffix] ?? SESSION_TAB_LABEL[suffix] ?? null;

  return (
    <div className="border-b border-slate-200 bg-slate-50/60 px-8 py-1.5 text-xs text-slate-500">
      {parentLabel && session.projectId ? (
        <>
          <Link href={`/admin/projects/${session.projectId}${parentSuffix}`} className="hover:text-indigo-600 hover:underline">
            {parentLabel}
          </Link>{" "}
          <span className="text-slate-300">›</span> <span className="text-slate-600">{childLabel ?? session.name}</span>
        </>
      ) : (
        <span className="text-slate-600">{childLabel ?? session.name}</span>
      )}
    </div>
  );
}
