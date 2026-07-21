"use client";

import { usePathname } from "next/navigation";
import DeleteSessionButton from "@/components/DeleteSessionButton";
import { SESSION_TAB_LABEL as TAB_LABEL } from "@/lib/session-nav";

// 분과 상세 헤더 — 제목(탭명/분과명) + 삭제. '돌아가기'는 브레드크럼 아래 SessionBackBar에서 처리한다.
export default function SessionHeader({
  sessionId,
  sessionName,
}: {
  sessionId: string;
  sessionName: string;
  projectId?: string | null;
}) {
  const pathname = usePathname();
  const base = `/admin/sessions/${sessionId}`;
  const suffix = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const tab = TAB_LABEL[suffix];
  const isMain = suffix === "";

  return (
    <div className="flex items-center justify-between gap-3 print:hidden">
      <h1 className="text-2xl font-bold">{tab ?? sessionName}</h1>
      {isMain && <DeleteSessionButton sessionId={sessionId} sessionName={sessionName} />}
    </div>
  );
}
