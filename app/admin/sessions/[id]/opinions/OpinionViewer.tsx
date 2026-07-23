"use client";

import { useEffect, useState } from "react";

type OpinionItem = {
  evaluatorId: string;
  evaluatorName: string;
  subjectId: string;
  subjectName: string;
  text: string;
};

const TRUNCATE_LENGTH = 200;

// 평가위원장이 지원기업별로 작성한 종합의견을 표시(평가위원장 / 종합의견 2컬럼).
// 긴 텍스트는 잘라서 보여주고 "더보기" 클릭 시 모달로 전체 텍스트를 표시.
export default function OpinionViewer({ items }: { items: OpinionItem[] }) {
  const [modalItem, setModalItem] = useState<OpinionItem | null>(null);

  useEffect(() => {
    if (!modalItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalItem(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalItem]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">총 {items.length}건</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400">작성된 평가위원장 통합의견이 없습니다.</div>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="w-40 px-5 py-3 font-medium">평가위원장</th>
                <th className="px-5 py-3 font-medium">종합의견</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLong = item.text.length > TRUNCATE_LENGTH;
                const preview = isLong ? `${item.text.slice(0, TRUNCATE_LENGTH)}…` : item.text;
                return (
                  <tr key={`${item.evaluatorId}:${item.subjectId}`} className="border-b border-slate-50 align-top last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-700">{item.evaluatorName}</td>
                    <td className="px-5 py-3 text-slate-600">
                      <p className="line-clamp-3 whitespace-pre-wrap leading-relaxed">{preview}</p>
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setModalItem(item)}
                          className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          …더보기
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setModalItem(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <h3 className="text-sm font-semibold text-slate-800">
                {modalItem.evaluatorName}
                <span className="ml-1 text-xs font-normal text-indigo-500">(위원장)</span>
                <span className="mx-1.5 text-slate-300">·</span>
                {modalItem.subjectName}
              </h3>
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{modalItem.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
