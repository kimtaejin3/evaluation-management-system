"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DeleteSessionButton from "@/components/DeleteSessionButton";

// 분과 하위 탭 경로 → 탭 이름 (사이드바 SUB_ITEMS와 동일)
const TAB_LABEL: Record<string, string> = {
  "": "실시간 진행 상황",
  "/criteria": "평가 항목",
  "/subjects": "평가 대상",
  "/evaluators": "평가위원",
  "/results": "집계 결과",
};

export default function SessionHeader({
  sessionId,
  sessionName,
  projectId,
}: {
  sessionId: string;
  sessionName: string;
  projectId: string | null;
}) {
  const pathname = usePathname();
  const base = `/admin/sessions/${sessionId}`;
  const suffix = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const tab = TAB_LABEL[suffix];
  const isMain = suffix === "";

  return (
    <div className="print:hidden">
      <Link
        href={projectId ? `/admin/projects/${projectId}` : "/admin/sessions"}
        className="text-sm text-slate-400 hover:text-slate-600"
      >
        ← {projectId ? "과제로" : "분과 목록"}
      </Link>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{tab ?? sessionName}</h1>
        {isMain && <DeleteSessionButton sessionId={sessionId} sessionName={sessionName} />}
      </div>
    </div>
  );
}
