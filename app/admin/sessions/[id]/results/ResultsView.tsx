"use client";

import { useEffect, useState } from "react";
import RankingTable, { type RankSubject, type RankCriterion, type RankEvaluator } from "@/components/RankingTable";
import SheetPrintPicker from "@/components/SheetPrintPicker";
import SubjectScorePicker from "@/components/SubjectScorePicker";
import { overallGrade } from "@/lib/scoring";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// 선정 결과(1위) 요약 + 순위표를 페이지에 상시 노출, 인쇄 도구는 모달로 연다.
export default function ResultsView({
  sessionId,
  winners,
  subjects,
  criteria,
  evaluators,
  scores,
  maxTotal,
}: {
  sessionId: string;
  winners: { id: string; name: string; finalScore: number }[];
  subjects: RankSubject[];
  criteria: RankCriterion[];
  evaluators: RankEvaluator[];
  scores: Record<string, number>;
  maxTotal: number;
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
      {/* 선정 결과 카드 */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 print:border-black">
        <div className="text-sm font-semibold text-slate-500">선정 결과 (1위)</div>
        {winners.length === 0 ? (
          <p className="mt-2 text-slate-400">아직 선정된 대상이 없습니다.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {winners.map((w) => (
              <div key={w.id} className="flex flex-wrap items-baseline gap-2.5">
                <span className="rounded-md bg-[var(--gov-navy)] px-2 py-0.5 text-xs font-bold text-white print:bg-transparent print:text-black">
                  선정
                </span>
                <span className="text-2xl font-bold text-slate-900">{w.name}</span>
                <span className="text-sm text-slate-500">
                  최종 {fmt(w.finalScore)} / {fmt(maxTotal)} · {overallGrade(w.finalScore, maxTotal)}등급
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 print:hidden"
        >
          인쇄
        </button>
      </div>

      {/* 순위표 */}
      <section className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">순위</h3>
        <RankingTable subjects={subjects} criteria={criteria} evaluators={evaluators} scores={scores} maxTotal={maxTotal} />
      </section>

      {/* 인쇄 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8 print:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-4 w-full max-w-5xl space-y-6 rounded-2xl bg-white p-6 shadow-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">인쇄</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100"
              >
                닫기
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* 위원별 평가표 인쇄 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">위원별 평가표 인쇄</h3>
                <p className="text-xs text-slate-400">위원을 고른 뒤 대상별로 해당 위원의 평가표를 인쇄합니다.</p>
                <SheetPrintPicker
                  sessionId={sessionId}
                  evaluators={evaluators.map((e) => ({ id: e.id, name: e.name }))}
                  subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
                />
              </section>

              {/* 기업별 위원 점수 인쇄 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">기업별 위원 점수 인쇄</h3>
                <p className="text-xs text-slate-400">대상별로 모든 위원이 매긴 점수표를 인쇄합니다.</p>
                <SubjectScorePicker sessionId={sessionId} subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
