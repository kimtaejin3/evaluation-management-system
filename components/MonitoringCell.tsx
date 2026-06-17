"use client";

import { useEffect, useState } from "react";
import type { Cell } from "@/lib/progress";

// (대상 × 위원) 한 칸: 상태 텍스트 + 클릭 시 항목별 입력 현황 모달
export default function MonitoringCell({
  cell,
  subjectName,
  evaluatorName,
}: {
  cell: Cell;
  subjectName: string;
  evaluatorName: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (cell.total === 0) return <span className="text-slate-300">—</span>;

  const label =
    cell.state === "done"
      ? "입력완료"
      : cell.state === "partial"
        ? "입력중"
        : "미입력";
  const cls =
    cell.state === "done"
      ? "text-emerald-700 hover:bg-emerald-50"
      : cell.state === "partial"
        ? "text-amber-700 hover:bg-amber-50"
        : "text-slate-400 hover:bg-slate-100";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition ${cls}`}
        title="클릭하여 항목별 입력 현황 보기"
      >
        {label}
        <span className="text-xs font-normal text-slate-400 tabular-nums">
          {cell.done}/{cell.total}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">
                  {subjectName}
                </div>
                <div className="text-xs text-slate-500">
                  {evaluatorName} 위원 · {label} ({cell.done}/{cell.total})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <ul className="mt-3 max-h-80 space-y-1 overflow-auto">
              {cell.items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${it.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}
                  >
                    {it.done ? "✓" : "·"}
                  </span>
                  <span
                    className={it.done ? "text-slate-700" : "text-slate-400"}
                  >
                    {it.name}
                  </span>
                  <span
                    className={`ml-auto text-xs ${it.done ? "text-emerald-600" : "text-slate-400"}`}
                  >
                    {it.done ? "입력완료" : "미입력"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
