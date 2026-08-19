'use client'

import { useState } from 'react'

// 관리 테이블 공용 클라이언트 정렬.
// - 같은 헤더를 다시 누르면 오름/내림차순 토글, 다른 헤더를 누르면 그 컬럼 오름차순
// - 빈 값(null/undefined/'')은 방향과 무관하게 항상 뒤로
// - 숫자는 수치 비교, 문자열은 한국어 locale(숫자 인지) 비교
export type SortDir = 'asc' | 'desc'

export function useClientSort<K extends string>() {
  const [sortKey, setSortKey] = useState<K | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const toggleSort = (key: K) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortRows = <T,>(rows: T[], get: (row: T, key: K) => string | number | null | undefined): T[] => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = get(a, sortKey)
      const bv = get(b, sortKey)
      const aEmpty = av === null || av === undefined || av === ''
      const bEmpty = bv === null || bv === undefined || bv === ''
      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1
      if (bEmpty) return -1
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'ko', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  return { sortKey, sortDir, toggleSort, sortRows }
}

// 클릭 정렬 헤더 셀 — ▲(오름차순)/▼(내림차순)/↕(미정렬) 표기. 구 SortableTh(서버 URL 방식)를 대체
export function SortTh<K extends string>({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
  className = 'px-5 py-3 font-medium',
}: {
  label: string
  field: K
  sortKey: K | null
  sortDir: SortDir
  onSort: (key: K) => void
  className?: string
}) {
  const active = sortKey === field
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 whitespace-nowrap hover:underline"
        title={`${label} 정렬`}
      >
        {label}
        <span className="text-xs opacity-80" aria-hidden>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}
