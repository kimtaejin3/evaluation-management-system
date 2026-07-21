// 분과 평가 상태 태그(전 테이블 공통) — 배경·테두리 없이 검은 텍스트, '완료'만 굵게.
const MAP = {
  DRAFT: { label: '준비', bold: false },
  IN_PROGRESS: { label: '진행중', bold: false },
  CLOSED: { label: '완료', bold: true },
} as const

export type SessionStatus = keyof typeof MAP

export default function StatusBadge({ status }: { status: SessionStatus }) {
  const s = MAP[status]
  return (
    <span className={`text-xs whitespace-nowrap text-slate-900 ${s.bold ? 'font-bold' : 'font-normal'}`}>
      {s.label}
    </span>
  )
}
