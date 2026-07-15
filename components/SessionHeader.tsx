"use client";

import { usePathname, useRouter } from "next/navigation";
import DeleteSessionButton from "@/components/DeleteSessionButton";
import { SESSION_TAB_LABEL as TAB_LABEL } from "@/lib/session-nav";

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
  const router = useRouter();
  const base = `/admin/sessions/${sessionId}`;
  const suffix = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const tab = TAB_LABEL[suffix];
  const isMain = suffix === "";

  // 직전에 조회한 페이지로 복귀. 히스토리가 없으면(새 탭 직행) 소속 과제/분과 목록으로.
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(projectId ? `/admin/projects/${projectId}` : "/admin/sessions");
  };

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={goBack}
        className="text-sm text-slate-400 transition hover:text-slate-600"
      >
        ← 돌아가기
      </button>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{tab ?? sessionName}</h1>
        {isMain && <DeleteSessionButton sessionId={sessionId} sessionName={sessionName} />}
      </div>
    </div>
  );
}
