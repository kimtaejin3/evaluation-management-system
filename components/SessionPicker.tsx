'use client'

import { useRouter } from 'next/navigation'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  IN_PROGRESS: '진행중',
  CLOSED: '마감',
}

export default function SessionPicker({
  sessions,
  currentId,
}: {
  sessions: { id: string; name: string; status: string }[]
  currentId: string
}) {
  const router = useRouter()
  return (
    <select
      value={currentId}
      onChange={(e) => router.push(`/admin?session=${e.target.value}`)}
      className="max-w-[24rem] truncate rounded-md border border-slate-300 bg-white px-3 py-1.5 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      aria-label="회차 선택"
    >
      {sessions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} ({STATUS_LABEL[s.status] ?? s.status})
        </option>
      ))}
    </select>
  )
}
