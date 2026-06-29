"use client";

import { useEffect, useState } from "react";
import SubjectImportForm from "./SubjectImportForm";

export default function SubjectImportButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
      >
        엑셀·한글 가져오기
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">평가 대상 엑셀·한글 가져오기</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  기업 명단을 업로드하거나 붙여넣어 이 분과의 평가 대상으로 한 번에 편입합니다.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <SubjectImportForm sessionId={sessionId} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
