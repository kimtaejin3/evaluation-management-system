const MAP = {
  DRAFT: { label: '초안', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  IN_PROGRESS: { label: '진행중', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CLOSED: { label: '마감', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
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
