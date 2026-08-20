import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionStatusControl from './SessionStatusControl'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const setSessionStatus = vi.fn()
vi.mock('@/app/admin/sessions/actions', () => ({
  setSessionStatus: (...args: unknown[]) => setSessionStatus(...args),
}))

describe('SessionStatusControl', () => {
  beforeEach(() => {
    setSessionStatus.mockReset().mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("준비 상태면 배지와 '평가 시작' 버튼이 보인다", () => {
    render(<SessionStatusControl sessionId="s1" status="DRAFT" />)
    expect(screen.getByText('준비')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '평가 시작' })).toBeInTheDocument()
  })

  it("'평가 시작' 확인 시 IN_PROGRESS로 상태 변경 액션을 호출한다", async () => {
    const user = userEvent.setup()
    render(<SessionStatusControl sessionId="s1" status="DRAFT" />)
    await user.click(screen.getByRole('button', { name: '평가 시작' }))
    expect(setSessionStatus).toHaveBeenCalledWith('s1', 'IN_PROGRESS')
  })

  it('확인을 취소하면 액션을 호출하지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<SessionStatusControl sessionId="s1" status="DRAFT" />)
    await user.click(screen.getByRole('button', { name: '평가 시작' }))
    expect(setSessionStatus).not.toHaveBeenCalled()
  })

  it('진행중/완료 상태에서는 버튼 없이 배지만 보인다(상태 변경 모달 없음)', () => {
    render(<SessionStatusControl sessionId="s1" status="IN_PROGRESS" />)
    expect(screen.getByText('진행중')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    cleanup()
    render(<SessionStatusControl sessionId="s1" status="CLOSED" />)
    expect(screen.getByText('완료')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
