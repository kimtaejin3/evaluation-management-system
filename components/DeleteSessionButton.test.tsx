import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeleteSessionButton from './DeleteSessionButton'

const deleteSession = vi.fn()
vi.mock('@/app/admin/sessions/actions', () => ({
  deleteSession: (...args: unknown[]) => deleteSession(...args),
}))

describe('DeleteSessionButton', () => {
  beforeEach(() => {
    deleteSession.mockReset()
  })
  afterEach(() => cleanup())

  it('삭제 버튼 클릭 전에는 확인 모달이 없다', () => {
    render(<DeleteSessionButton sessionId="s1" sessionName="1분과" />)
    expect(screen.queryByRole('heading', { name: '분과 삭제' })).not.toBeInTheDocument()
  })

  it('삭제 버튼 클릭 시 분과명·되돌릴 수 없음 경고·삭제 범위를 표시한다', async () => {
    const user = userEvent.setup()
    render(<DeleteSessionButton sessionId="s1" sessionName="1분과" />)
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.getByRole('heading', { name: '분과 삭제' })).toBeInTheDocument()
    expect(screen.getByText('1분과')).toBeInTheDocument()
    expect(screen.getByText('되돌릴 수 없습니다.')).toBeInTheDocument()
    expect(screen.getByText(/공통\(전 분과\) 자료는 보존됩니다/)).toBeInTheDocument()
  })

  it('취소 버튼으로 모달이 닫히고 액션은 호출되지 않는다', async () => {
    const user = userEvent.setup()
    render(<DeleteSessionButton sessionId="s1" sessionName="1분과" />)
    await user.click(screen.getByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('heading', { name: '분과 삭제' })).not.toBeInTheDocument()
    expect(deleteSession).not.toHaveBeenCalled()
  })

  it('Esc 키로 모달이 닫힌다', async () => {
    const user = userEvent.setup()
    render(<DeleteSessionButton sessionId="s1" sessionName="1분과" />)
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.getByRole('heading', { name: '분과 삭제' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { name: '분과 삭제' })).not.toBeInTheDocument()
  })

  it('삭제 확정 시 sessionId로 삭제 액션을 호출한다', async () => {
    const user = userEvent.setup()
    render(<DeleteSessionButton sessionId="s1" sessionName="1분과" />)
    await user.click(screen.getByRole('button', { name: '삭제' }))
    // 모달 안의 확정 '삭제' 버튼(두 번째)
    const deletes = screen.getAllByRole('button', { name: '삭제' })
    await user.click(deletes[deletes.length - 1])
    expect(deleteSession).toHaveBeenCalledWith('s1')
  })
})
