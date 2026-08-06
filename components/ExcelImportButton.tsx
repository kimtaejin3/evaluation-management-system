'use client'

import { useEffect, useState } from 'react'
import ImportCriteriaForm from './ImportCriteriaForm'
import EvaluatorImportForm from './EvaluatorImportForm'
import SubjectImportForm from './SubjectImportForm'

type Kind = 'criteria' | 'evaluators' | 'subjects'
const TITLE: Record<Kind, string> = { criteria: '평가항목', evaluators: '평가위원', subjects: '평가 대상' }

// 엑셀·한글 가져오기 트리거 — 버튼 + 모달(대화형 매핑 폼). 노출 게이팅은 호출부에서.
// scopeId: criteria = 사업(projectId, 관리자 전용), evaluators/subjects = 분과(sessionId, 담당자)
export default function ExcelImportButton({ scopeId, kind }: { scopeId: string; kind: Kind }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
          <path d="M10 12V3m0 0 3 3m-3-3-3 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 13v2.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V13" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        엑셀·한글 가져오기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4"
        >
          <div
            className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">{TITLE[kind]} 엑셀·한글 가져오기</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  엑셀 파일을 업로드하거나 복사·붙여넣어 일괄 생성합니다.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            {kind === 'criteria' && <ImportCriteriaForm projectId={scopeId} onDone={() => setOpen(false)} />}
            {kind === 'evaluators' && <EvaluatorImportForm sessionId={scopeId} onDone={() => setOpen(false)} />}
            {kind === 'subjects' && <SubjectImportForm sessionId={scopeId} onDone={() => setOpen(false)} />}
          </div>
        </div>
      )}
    </>
  )
}
