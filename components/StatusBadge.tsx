const MAP = {
  DRAFT: { label: '준비', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  IN_PROGRESS: { label: '진행중', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  CLOSED: { label: '완료', cls: 'bg-slate-200 text-slate-600 ring-slate-300' },
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
