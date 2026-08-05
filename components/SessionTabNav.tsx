"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SESSION_TABS } from "@/lib/session-nav";

// 분과 하위 페이지(실시간 진행 상황 · 평가 항목 · 평가 대상 …)의 이전/다음 탭 이동.
// ProjectTabNav의 분과 버전 — '돌아가기'만 있던 화면들에 앞/뒤 화살표 제공(고객 요청 C7).
export default function SessionTabNav() {
  const pathname = usePathname();
  const m = pathname.match(/^\/admin\/sessions\/([^/]+)(\/[^/]+)?$/);
  if (!m || m[1] === "new") return null;
  const id = m[1];
  const suffix = m[2] ?? "";
  const idx = SESSION_TABS.findIndex((t) => t.suffix === suffix);
  if (idx === -1) return null;

  const prev = SESSION_TABS[idx - 1];
  const next = SESSION_TABS[idx + 1];
  if (!prev && !next) return null;

  const link = "text-base font-semibold text-slate-600 transition hover:text-slate-900";

  return (
    <div className="flex items-center justify-end gap-4 px-8 pt-3 print:hidden">
      {prev && (
        <Link href={`/admin/sessions/${id}${prev.suffix}`} className={`inline-flex items-center gap-1.5 ${link}`}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0" aria-hidden>
            <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {prev.label}
        </Link>
      )}
      {prev && next && <span className="text-slate-300">|</span>}
      {next && (
        <Link href={`/admin/sessions/${id}${next.suffix}`} className={`inline-flex items-center gap-1.5 ${link}`}>
          {next.label}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0" aria-hidden>
            <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </div>
  );
}
