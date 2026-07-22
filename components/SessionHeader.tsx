"use client";

import { usePathname } from "next/navigation";
import DeleteSessionButton from "@/components/DeleteSessionButton";
import InfoIcon from "@/components/InfoIcon";
import { SESSION_TAB_LABEL as TAB_LABEL } from "@/lib/session-nav";

// 탭별 안내 문구 — 제목 옆에 정보 아이콘과 함께 인라인 표시.
const SUBTEXT: Record<string, string> = {
  "/opinions": "평가위원장이 각 지원기업에 대해 평가 화면에서 작성한 종합의견입니다.",
  "/results": "위원 평균 점수 기준 선정 결과입니다.",
};

// 분과 상세 헤더 — 제목(탭명/분과명) + 안내 문구 + 삭제. '돌아가기'는 브레드크럼 아래 SessionBackBar에서 처리한다.
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
  const subtext = SUBTEXT[suffix];

  return (
    <div className="flex items-start justify-between gap-3 print:hidden">
      {/* 제목 옆에 안내 문구를 정보 아이콘과 함께 인라인 배치 */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <h1 className="text-2xl font-bold">{tab ?? sessionName}</h1>
        {subtext && (
          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
            <InfoIcon />
            {subtext}
          </span>
        )}
      </div>
      {isMain && <DeleteSessionButton sessionId={sessionId} sessionName={sessionName} />}
    </div>
  );
}
