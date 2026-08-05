"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PROJECT_TABS } from "@/lib/project-nav";

// 사업 하위 페이지(사업 담당자 설정 · 평가 실시간 모니터링 · 평가항목 …)의 이전/다음 탭 이동.
// 좌상단 '← 사업 담당자 설정'(콘텐츠 내부)에 더해, 콘텐츠 바깥(레이아웃 레벨) 우상단에 배치한다.
export default function ProjectTabNav() {
  const pathname = usePathname();
  const m = pathname.match(/^\/admin\/projects\/([^/]+)(\/[^/]+)?$/);
  if (!m || m[1] === "new") return null;
  const id = m[1];
  const suffix = m[2] ?? "";
  const idx = PROJECT_TABS.findIndex((t) => t.suffix === suffix);
  if (idx === -1) return null;

  const prev = PROJECT_TABS[idx - 1];
  const next = PROJECT_TABS[idx + 1];
  if (!prev && !next) return null;

  const link = "text-base font-semibold text-slate-600 transition hover:text-slate-900";

  return (
    <div className="flex items-center justify-end gap-4 px-8 pt-3 print:hidden">
      {prev && (
        <Link href={`/admin/projects/${id}${prev.suffix}`} className={`inline-flex items-center gap-1.5 ${link}`}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0" aria-hidden>
            <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {prev.label}
        </Link>
      )}
      {prev && next && <span className="text-slate-300">|</span>}
      {next && (
        <Link href={`/admin/projects/${id}${next.suffix}`} className={`inline-flex items-center gap-1.5 ${link}`}>
          {next.label}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0" aria-hidden>
            <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </div>
  );
}
