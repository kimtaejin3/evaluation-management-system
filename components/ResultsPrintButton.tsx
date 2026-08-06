"use client";

import { useEffect, useState } from "react";
import SheetPrintPicker from "@/components/SheetPrintPicker";
import SubjectScorePicker from "@/components/SubjectScorePicker";

// 집계 결과 인쇄 도구 — 상단 툴바(엑셀 내보내기 옆)에 두는 '인쇄' 버튼 + 모달.
// 위원별 평가표 / 기업별 위원 점수 인쇄를 모달에서 고른다.
export default function ResultsPrintButton({
  sessionId,
  subjects,
  evaluators,
}: {
  sessionId: string;
  subjects: { id: string; name: string }[];
  evaluators: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 print:hidden"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
          <path d="M6 7V3h8v4M6 15H4v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4h-2M6 13h8v4H6z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        인쇄
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8 print:hidden">
          <div className="my-4 w-full max-w-5xl space-y-6 rounded-2xl bg-white p-6 shadow-xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">인쇄</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100">
                닫기
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* 위원별 평가표 인쇄 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">위원별 평가표 인쇄</h3>
                <p className="text-xs text-slate-400">위원을 고른 뒤 대상별로 해당 위원의 평가표를 인쇄합니다.</p>
                <SheetPrintPicker sessionId={sessionId} evaluators={evaluators} subjects={subjects} />
              </section>

              {/* 기업별 위원 점수 인쇄 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">기업별 위원 점수 인쇄</h3>
                <p className="text-xs text-slate-400">대상별로 모든 위원이 매긴 점수표를 인쇄합니다.</p>
                <SubjectScorePicker sessionId={sessionId} subjects={subjects} />
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
