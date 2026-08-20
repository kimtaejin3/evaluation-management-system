'use client'

import { useState } from 'react'
import SubjectsTable, { type SubjectRow } from '@/components/SubjectsTable'
import ExcelExportButton from '@/components/ExcelExportButton'
import ExcelImportButton from '@/components/ExcelImportButton'
import { addSubject } from '@/app/admin/sessions/actions'

export type BrowserSession = {
  id: string
  name: string
  secretaryName: string | null
  locked: boolean // 마감(CLOSED) — 편집 불가
  subjects: SubjectRow[]
}

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

// 사업 평가대상 브라우저 — 분과 탭을 골라 그 분과의 기업(평가 대상)을 이 페이지에서
// 바로 보고 편집한다(추가·수정·삭제·서류·가져오기 = 분과 화면과 동일 기능).
export default function ProjectSubjectsBrowser({ sessions }: { sessions: BrowserSession[] }) {
  const [activeId, setActiveId] = useState(sessions[0]?.id ?? '')
  const active = sessions.find((s) => s.id === activeId) ?? sessions[0] ?? null

  if (!active) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
        아직 분과가 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 분과 선택 — 관리 화면 공용 스타일 드롭다운 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600">분과 선택</span>
        <span className="relative">
          <select
            value={active.id}
            onChange={(e) => setActiveId(e.target.value)}
            aria-label="분과 선택"
            className="h-9 appearance-none rounded-lg border border-slate-300 bg-white pr-8 pl-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.subjects.length})
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400">
            ▾
          </span>
        </span>
      </div>

      {/* 선택 분과 정보줄 + 가져오기 도구 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span>
          담당자{' '}
          {active.secretaryName ? (
            <b className="font-medium text-slate-700">{active.secretaryName}</b>
          ) : (
            <span className="text-rose-600">미배정</span>
          )}
        </span>
        <span>
          평가 대상 <b className="font-medium text-slate-700">{active.subjects.length}개</b>
        </span>
        {active.locked && <span className="text-xs text-slate-400">마감된 분과 — 조회만 가능합니다</span>}
        {!active.locked && (
          <span className="ml-auto flex items-center gap-2">
            <ExcelExportButton href="/api/subjects-template" label="양식 다운로드" />
            <ExcelImportButton key={active.id} scopeId={active.id} kind="subjects" />
          </span>
        )}
      </div>

      {/* 대상 추가 — 분과 화면과 동일한 등록 폼 */}
      {!active.locked && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-700">평가 대상 추가</div>
          <form key={active.id} action={addSubject.bind(null, active.id)} className="flex flex-wrap gap-2">
            <input name="newName" required placeholder="새 기업명" className={`min-w-40 flex-1 ${inputCls}`} />
            <input name="region" required placeholder="지역" className={`w-28 ${inputCls}`} />
            <input name="leadResearcher" required placeholder="연구책임자" className={`w-32 ${inputCls}`} />
            <input name="businessNo" placeholder="사업자등록번호" className={`w-40 ${inputCls}`} />
            <button className="shrink-0 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50">
              신규 등록
            </button>
          </form>
          <p className="text-xs text-slate-400">지역·연구책임자는 인쇄 평가표 헤더에 사용됩니다.</p>
        </div>
      )}

      {/* 기업 목록 — 분과 화면과 동일한 편집 테이블(수정·삭제·서류 관리) */}
      <SubjectsTable
        key={active.id}
        sessionId={active.id}
        canEdit={!active.locked}
        canManageDocs={!active.locked}
        subjects={active.subjects}
      />
    </div>
  )
}
