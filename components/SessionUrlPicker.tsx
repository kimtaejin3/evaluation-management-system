'use client'

import { usePathname, useRouter } from 'next/navigation'

// 분과 선택 드롭다운(URL 쿼리 방식) — 사업 하위 페이지에서 ?session= 으로 분과를 골라
// 하단에 그 분과의 화면을 그대로 임베드할 때 사용한다.
export default function SessionUrlPicker({
  sessions,
  current,
}: {
  sessions: { id: string; name: string }[]
  current: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-600">분과 선택</span>
      <span className="relative">
        <select
          value={current}
          onChange={(e) => router.replace(`${pathname}?session=${e.target.value}`, { scroll: false })}
          aria-label="분과 선택"
          className="h-9 appearance-none rounded-lg border border-slate-300 bg-white pr-8 pl-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400">
          ▾
        </span>
      </span>
    </div>
  )
}
