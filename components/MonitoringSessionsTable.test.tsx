import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonitoringSessionsTable, { type MonitoringRow } from './MonitoringSessionsTable'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/admin/sessions/actions', () => ({
  deleteSessionFromProject: vi.fn().mockResolvedValue({ ok: true }),
}))

const ROWS: MonitoringRow[] = [
  { id: 's1', name: 'A분과', status: 'IN_PROGRESS', period: '2026-03-01 ~ 2026-12-31', secretaryName: '김담당', subjectCount: 2, assignedCount: 3, completedEvaluators: 1, written: 0, expected: 6 },
  { id: 's2', name: 'B분과', status: 'DRAFT', period: '미정', secretaryName: null, subjectCount: 0, assignedCount: 0, completedEvaluators: 0, written: 0, expected: 0 },
]

const renderTable = (isMaster = true) =>
  render(<MonitoringSessionsTable projectId="p1" rows={ROWS} isMaster={isMaster} dir="asc" />)

describe('MonitoringSessionsTable', () => {
  afterEach(() => cleanup())

  it('마스터면 체크박스와 하단 분과 삭제 버튼이 있고, 행별 삭제 버튼은 없다', () => {
    renderTable(true)
    expect(screen.getByRole('button', { name: '분과 삭제' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '전체 선택' })).toBeInTheDocument()
    expect(screen.getByText('A분과')).toBeInTheDocument()
  })

  it('행 선택 후 분과 삭제 → 확인 모달에 선택 분과가 표시된다', async () => {
    const user = userEvent.setup()
    renderTable(true)
    await user.click(screen.getByText('A분과'))
    expect(screen.getByText('1개 선택됨')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '분과 삭제' }))
    expect(screen.getByRole('heading', { name: '분과 삭제' })).toBeInTheDocument()
    expect(screen.getByText(/선택한 분과 1개를 삭제/)).toBeInTheDocument()
  })

  it('마스터가 아니면 체크박스·삭제 버튼이 없다', () => {
    renderTable(false)
    expect(screen.queryByRole('button', { name: '전체 선택' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '분과 삭제' })).not.toBeInTheDocument()
    // 자세히 보기 링크는 남는다
    expect(screen.getAllByRole('link', { name: '자세히 보기' }).length).toBe(ROWS.length)
  })
})
