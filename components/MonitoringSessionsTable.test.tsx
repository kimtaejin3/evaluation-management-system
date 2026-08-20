import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import MonitoringSessionsTable, { type MonitoringRow } from './MonitoringSessionsTable'

const ROWS: MonitoringRow[] = [
  { id: 's1', name: 'A분과', status: 'IN_PROGRESS', period: '2026-01-01 ~ 2026-02-01', startDate: '2026-01-01', endDate: '2026-02-01', secretaryName: '김담당', subjectCount: 3, assignedCount: 4, completedEvaluators: 2 },
  { id: 's2', name: 'B분과', status: 'DRAFT', period: '미정', startDate: '', endDate: '', secretaryName: null, subjectCount: 0, assignedCount: 0, completedEvaluators: 0 },
]

describe('MonitoringSessionsTable', () => {
  afterEach(() => cleanup())

  it('조회 전용 — 체크박스·분과 정보 변경 없이 현황만 보여준다', () => {
    render(<MonitoringSessionsTable rows={ROWS} />)
    expect(screen.getByText('A분과')).toBeInTheDocument()
    expect(screen.getByText('B분과')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '전체 선택' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '분과 정보 변경' })).not.toBeInTheDocument()
    // 위원 수·의견서 열은 '평가위원 작성 현황'으로 통합
    expect(screen.getByRole('button', { name: /평가위원 작성 현황/ })).toBeInTheDocument()
    expect(screen.queryByText(/평가위원 수/)).not.toBeInTheDocument()
    expect(screen.queryByText(/평가 의견서/)).not.toBeInTheDocument()
    // 자세히 보기 링크는 유지
    expect(screen.getAllByRole('link', { name: '자세히 보기' })).toHaveLength(2)
  })
})
