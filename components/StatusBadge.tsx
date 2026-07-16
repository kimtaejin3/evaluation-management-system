// 상태 색 체계(전 테이블 공통): 준비=회색, 진행중=파랑, 완료=초록.
// 대기·미제출류는 주황(amber), 반려는 장미색(rose) — ReviewStatusBadge 참고.
const MAP = {
  DRAFT: { label: '준비', cls: 'bg-slate-200 text-slate-700 ring-slate-300' },
  IN_PROGRESS: { label: '진행중', cls: 'bg-blue-100 text-blue-800 ring-blue-300' },
  CLOSED: { label: '완료', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
} as const

export type SessionStatus = keyof typeof MAP

export default function StatusBadge({ status }: { status: SessionStatus }) {
  const s = MAP[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      {s.label}
    </span>
  )
}
