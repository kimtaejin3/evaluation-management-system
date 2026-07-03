import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionStatusControl from './SessionStatusControl'

const setSessionStatus = vi.fn()
vi.mock('@/app/admin/sessions/actions', () => ({
  setSessionStatus: (...args: unknown[]) => setSessionStatus(...args),
}))

// eventDate 계산의 기준이 되는 미래/과거 날짜
const FUTURE = '2999-01-01T00:00:00.000Z'
const PAST = '2000-01-01T00:00:00.000Z'

async function openModal() {
  const user = userEvent.setup()
  // 배지 버튼(진행 상태) 클릭으로 모달 오픈
  await user.click(screen.getByTitle('클릭하여 진행 상태 변경'))
  return user
}

describe('SessionStatusControl', () => {
  beforeEach(() => {
    setSessionStatus.mockReset()
  })
  afterEach(() => cleanup())

  it('배지 클릭 전에는 모달이 보이지 않는다', () => {
    render(<SessionStatusControl sessionId="s1" status="DRAFT" eventDate={null} />)
    expect(screen.queryByText('진행 상태 변경')).not.toBeInTheDocument()
  })

  it('DRAFT에서는 평가 시작 버튼만 활성화된다', async () => {
    render(<SessionStatusControl sessionId="s1" status="DRAFT" eventDate={null} />)
    await openModal()
    expect(screen.getByRole('button', { name: '평가 시작' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '마감·잠금' })).toBeDisabled()
    // CLOSED 상태가 아니므로 마감 해제 버튼은 없다
    expect(screen.queryByRole('button', { name: /마감 해제/ })).not.toBeInTheDocument()
  })

  it('DRAFT에서 평가 시작 클릭 시 IN_PROGRESS로 상태 변경 액션을 호출한다', async () => {
    render(<SessionStatusControl sessionId="s1" status="DRAFT" eventDate={null} />)
    const user = await openModal()
    await user.click(screen.getByRole('button', { name: '평가 시작' }))
    expect(setSessionStatus).toHaveBeenCalledWith('s1', 'IN_PROGRESS')
  })

  it('IN_PROGRESS이고 평가 일시가 없으면 마감 버튼이 활성화된다', async () => {
    render(<SessionStatusControl sessionId="s1" status="IN_PROGRESS" eventDate={null} />)
    await openModal()
    expect(screen.getByRole('button', { name: '평가 시작' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '마감·잠금' })).toBeEnabled()
  })

  it('IN_PROGRESS이고 평가 일시가 과거면 마감 버튼이 활성화된다', async () => {
    render(<SessionStatusControl sessionId="s1" status="IN_PROGRESS" eventDate={PAST} />)
    await openModal()
    expect(screen.getByRole('button', { name: '마감·잠금' })).toBeEnabled()
  })

  it('IN_PROGRESS이고 평가 일시가 미래면 마감 버튼이 비활성화되고 안내 문구를 보여준다', async () => {
    render(<SessionStatusControl sessionId="s1" status="IN_PROGRESS" eventDate={FUTURE} />)
    await openModal()
    expect(screen.getByRole('button', { name: '마감·잠금' })).toBeDisabled()
    expect(screen.getByText(/이후에 마감할 수 있습니다/)).toBeInTheDocument()
  })

  it('CLOSED에서는 마감 해제 버튼이 보이고 클릭 시 IN_PROGRESS로 되돌린다', async () => {
    render(<SessionStatusControl sessionId="s1" status="CLOSED" eventDate={null} />)
    const user = await openModal()
    const unlock = screen.getByRole('button', { name: /마감 해제/ })
    expect(unlock).toBeEnabled()
    await user.click(unlock)
    expect(setSessionStatus).toHaveBeenCalledWith('s1', 'IN_PROGRESS')
  })

  it('Esc 키로 모달이 닫힌다', async () => {
    render(<SessionStatusControl sessionId="s1" status="DRAFT" eventDate={null} />)
    const user = await openModal()
    expect(screen.getByText('진행 상태 변경')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('진행 상태 변경')).not.toBeInTheDocument()
  })
})
