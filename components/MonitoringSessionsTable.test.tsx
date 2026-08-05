import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonitoringSessionsTable, { type MonitoringRow } from './MonitoringSessionsTable'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/admin/sessions/actions', () => ({
  deleteSessionFromProject: vi.fn().mockResolvedValue({ ok: true }),
  updateSession: vi.fn().mockResolvedValue({ ok: true }),
}))

const ROWS: MonitoringRow[] = [
  { id: 's1', name: 'A분과', status: 'IN_PROGRESS', period: '2026-03-01 ~ 2026-12-31', startDate: '2026-03-01', endDate: '2026-12-31', secretaryName: '김담당', subjectCount: 2, assignedCount: 3, completedEvaluators: 1, written: 0, expected: 6 },
  { id: 's2', name: 'B분과', status: 'DRAFT', period: '미정', startDate: '', endDate: '', secretaryName: null, subjectCount: 0, assignedCount: 0, completedEvaluators: 0, written: 0, expected: 0 },
]

const renderTable = (isMaster = true) =>
  render(<MonitoringSessionsTable projectId="p1" rows={ROWS} isMaster={isMaster} dir="asc" />)

describe('MonitoringSessionsTable', () => {
  afterEach(() => cleanup())

  it('마스터면 체크박스와 하단 분과 정보 변경 버튼이 있다', () => {
    renderTable(true)
    expect(screen.getByRole('button', { name: '분과 정보 변경' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '전체 선택' })).toBeInTheDocument()
    expect(screen.getByText('A분과')).toBeInTheDocument()
  })

  it('1개 선택 후 정보 변경 → 분과명·기간 수정 폼과 삭제 버튼이 뜬다', async () => {
    const user = userEvent.setup()
    renderTable(true)
    await user.click(screen.getByText('A분과'))
    expect(screen.getByText('1개 선택됨')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '분과 정보 변경' }))
    expect(screen.getByRole('heading', { name: '분과 정보 변경' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('A분과')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-03-01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '정보 저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('2개 선택 후 정보 변경 → 삭제만(수정 폼 없음)', async () => {
    const user = userEvent.setup()
    renderTable(true)
    await user.click(screen.getByText('A분과'))
    await user.click(screen.getByText('B분과'))
    await user.click(screen.getByRole('button', { name: '분과 정보 변경' }))
    expect(screen.getByText(/삭제만 가능합니다/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '정보 저장' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('마스터가 아니면 체크박스·정보 변경 버튼이 없다', () => {
    renderTable(false)
    expect(screen.queryByRole('button', { name: '전체 선택' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '분과 정보 변경' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '자세히 보기' }).length).toBe(ROWS.length)
  })
})
