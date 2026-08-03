"use client";

import { usePathname, useRouter } from "next/navigation";

type Sess = { id: string; projectId?: string | null };

// 브레드크럼(PWD 경로) 바로 아래, 같은 전체 폭·좌측 라인(px-8)에 놓이는 '돌아가기'.
// 본문(max-w-7xl 중앙 정렬)과 무관하게 항상 브레드크럼 텍스트와 왼쪽 정렬이 맞는다.
// 분과 상세 경로에서만 표시(관리자·담당자 공통).
export default function SessionBackBar({ sessions = [] }: { sessions?: Sess[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const m = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  if (!m || m[1] === "new") return null;
  const session = sessions.find((s) => s.id === m[1]);
  if (!session) return null;

  // 직전 페이지로 복귀. 히스토리가 없으면(새 탭 직행) 소속 사업/분과 목록으로.
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(session.projectId ? `/admin/projects/${session.projectId}` : "/admin/sessions");
  };

  return (
    <div className="px-8 pt-3 print:hidden">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1 text-base font-semibold leading-none text-slate-600 transition hover:text-slate-900"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0" aria-hidden>
          <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        돌아가기
      </button>
    </div>
  );
}
