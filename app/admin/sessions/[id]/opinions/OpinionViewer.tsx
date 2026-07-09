"use client";

import { useState } from "react";

type Evaluator = { id: string; name: string; isChair: boolean };
type Subject = { id: string; name: string };

// 위원을 드롭다운으로 선택 → 해당 위원의 지원기업별 종합의견 표시.
export default function OpinionViewer({
  evaluators,
  subjects,
  opinions,
}: {
  evaluators: Evaluator[];
  subjects: Subject[];
  opinions: Record<string, string>;
}) {
  const [evaluatorId, setEvaluatorId] = useState(evaluators[0]?.id ?? "");
  const written = subjects.filter((s) => opinions[`${evaluatorId}:${s.id}`]).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">평가위원</span>
          <select
            value={evaluatorId}
            onChange={(e) => setEvaluatorId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {evaluators.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {ev.isChair ? " (위원장)" : ""}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-400">종합의견 {written}/{subjects.length} 작성</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {subjects.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400">평가 대상(지원기업)이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="w-56 px-5 py-3 font-medium">지원기업</th>
                <th className="px-5 py-3 font-medium">종합의견</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const text = opinions[`${evaluatorId}:${s.id}`];
                return (
                  <tr key={s.id} className="border-b border-slate-50 align-top last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-700">{s.name}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {text ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                      ) : (
                        <span className="text-slate-300">미작성</span>
                      )}
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
