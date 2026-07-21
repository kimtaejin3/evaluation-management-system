"use client";

import { useState } from "react";
import SubjectScoresDetail from "@/components/SubjectScoresDetail";

export type DivisionRow = {
  id: string;
  name: string;
  rank: number;
  score: number | null;
  evaluators: { name: string; isChair: boolean; score: number; opinion: string | null }[];
};

export type Division = {
  sessionName: string;
  rows: DivisionRow[];
};

// 분과별 평가 대상 점수 — 분과 테이블을 세로로 쌓지 않고 페이지네이션으로 한 분과씩 본다.
// 각 분과 안에서 점수순 순위·1위 하이라이트를 표시한다.
export default function DivisionScoresPager({ divisions }: { divisions: Division[] }) {
  const [page, setPage] = useState(0);
  if (divisions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-400">
        분과가 없습니다.
      </div>
    );
  }
  const cur = divisions[Math.min(page, divisions.length - 1)];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-600">
          {cur.sessionName} <span className="ml-0.5 text-xs text-slate-400">{cur.rows.length}개 대상</span>
        </h3>
        {/* 페이지네이션 — 분과 단위 */}
        {divisions.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            {divisions.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                title={d.sessionName}
                className={`min-w-7 rounded-md px-2 py-1 text-xs font-medium transition ${
                  i === page
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(divisions.length - 1, p + 1))}
              disabled={page === divisions.length - 1}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {cur.rows.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400">등록된 평가 대상이 없습니다.</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="w-20 px-5 py-2.5 font-medium">순위</th>
                <th className="px-5 py-2.5 font-medium">기업명</th>
                <th className="w-32 px-5 py-2.5 text-right font-medium">점수</th>
                <th className="w-36 px-5 py-2.5 font-medium">평가의견 보기</th>
              </tr>
            </thead>
            <tbody>
              {cur.rows.map((r) => {
                const isTop = r.rank === 1 && r.score !== null;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-50 last:border-0 ${isTop ? "bg-indigo-50/70 font-semibold" : "hover:bg-slate-50/60"}`}
                  >
                    <td className="px-5 py-2.5 tabular-nums">
                      <span className={isTop ? "font-bold text-indigo-700" : `font-medium ${r.score === null ? "text-slate-500" : "text-slate-700"}`}>
                        {r.rank}
                      </span>
                    </td>
                    <td className={`px-5 py-2.5 ${isTop ? "font-bold text-slate-900" : r.score === null ? "text-slate-500" : "font-medium text-slate-800"}`}>
                      {r.name}
                    </td>
                    <td className={`px-5 py-2.5 text-right tabular-nums ${isTop ? "font-bold text-indigo-700" : "font-medium text-slate-800"}`}>
                      {r.score !== null ? r.score.toFixed(2) : <span className="font-normal text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      <SubjectScoresDetail
                        subjectName={r.name}
                        buttonLabel="보기"
                        note="집계에 반영된(승인 제출) 위원별 점수와 종합의견입니다."
                        emptyMessage="집계에 반영된 위원 점수가 없습니다."
                        evaluators={r.evaluators}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
