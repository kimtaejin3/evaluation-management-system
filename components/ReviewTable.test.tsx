import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/admin/sessions/actions', () => ({
  approveEvaluation: vi.fn(() => Promise.resolve()),
  rejectEvaluation: vi.fn(() => Promise.resolve()),
}))
import { approveEvaluation, rejectEvaluation } from '@/app/admin/sessions/actions'
import ReviewTable from './ReviewTable'

const rows = [
  { subjectId: 's1', subjectName: '가나기업', evaluatorId: 'e1', evaluatorName: '김위원', status: 'submitted' as const, total: 70 },
  { subjectId: 's2', subjectName: '다라기업', evaluatorId: 'e2', evaluatorName: '이위원', status: 'partial' as const, total: null },
]

describe('ReviewTable', () => {
  it('제출완료 행만 승인/반려 버튼 활성', () => {
    render(<ReviewTable sessionId="sess1" rows={rows} />)
    const buttons = screen.getAllByRole('button', { name: '승인/반려' })
    expect(buttons[0]).toBeEnabled()
    expect(buttons[1]).toBeDisabled()
  })

  it('버튼 클릭 시 모달에서 승인 선택하면 approveEvaluation 호출', async () => {
    const user = userEvent.setup()
    render(<ReviewTable sessionId="sess1" rows={rows} />)
    await user.click(screen.getAllByRole('button', { name: '승인/반려' })[0])
    await user.click(screen.getByRole('button', { name: '승인' }))
    expect(approveEvaluation).toHaveBeenCalledWith('sess1', 's1', 'e1')
  })

  it('모달에서 반려 선택하면 rejectEvaluation 호출', async () => {
    const user = userEvent.setup()
    render(<ReviewTable sessionId="sess1" rows={rows} />)
    await user.click(screen.getAllByRole('button', { name: '승인/반려' })[0])
    await user.click(screen.getByRole('button', { name: '반려' }))
    expect(rejectEvaluation).toHaveBeenCalledWith('sess1', 's1', 'e1')
  })
})
