import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeleteProjectButton from './DeleteProjectButton'

const deleteProject = vi.fn()
vi.mock('@/app/admin/projects/actions', () => ({
  deleteProject: (...args: unknown[]) => deleteProject(...args),
}))

describe('DeleteProjectButton', () => {
  beforeEach(() => {
    deleteProject.mockReset()
  })
  afterEach(() => cleanup())

  it('삭제 버튼 클릭 전에는 확인 모달이 없다', () => {
    render(<DeleteProjectButton projectId="p1" projectName="테스트사업" sessionCount={0} />)
    expect(screen.queryByRole('heading', { name: '사업 삭제' })).not.toBeInTheDocument()
  })

  it('삭제 버튼 클릭 시 사업명이 포함된 확인 모달을 보여준다', async () => {
    const user = userEvent.setup()
    render(<DeleteProjectButton projectId="p1" projectName="테스트사업" sessionCount={0} />)
    await user.click(screen.getByRole('button', { name: '사업 삭제' }))
    expect(screen.getByRole('heading', { name: '사업 삭제' })).toBeInTheDocument()
    expect(screen.getByText('테스트사업')).toBeInTheDocument()
  })

  it('소속 분과가 있으면 개수와 미분류 안내를 표시한다', async () => {
    const user = userEvent.setup()
    render(<DeleteProjectButton projectId="p1" projectName="테스트사업" sessionCount={3} />)
    await user.click(screen.getByRole('button', { name: '사업 삭제' }))
    expect(screen.getByText('3개')).toBeInTheDocument()
    expect(screen.getByText(/미분류/)).toBeInTheDocument()
  })

  it('소속 분과가 없으면 분과 없음 안내를 표시한다', async () => {
    const user = userEvent.setup()
    render(<DeleteProjectButton projectId="p1" projectName="테스트사업" sessionCount={0} />)
    await user.click(screen.getByRole('button', { name: '사업 삭제' }))
    expect(screen.getByText('이 사업에는 소속 분과가 없습니다.')).toBeInTheDocument()
  })

  it('취소 버튼으로 모달이 닫히고 액션은 호출되지 않는다', async () => {
    const user = userEvent.setup()
    render(<DeleteProjectButton projectId="p1" projectName="테스트사업" sessionCount={0} />)
    await user.click(screen.getByRole('button', { name: '사업 삭제' }))
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('heading', { name: '사업 삭제' })).not.toBeInTheDocument()
    expect(deleteProject).not.toHaveBeenCalled()
  })

  it('Esc 키로 모달이 닫힌다', async () => {
    const user = userEvent.setup()
    render(<DeleteProjectButton projectId="p1" projectName="테스트사업" sessionCount={0} />)
    await user.click(screen.getByRole('button', { name: '사업 삭제' }))
    expect(screen.getByRole('heading', { name: '사업 삭제' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { name: '사업 삭제' })).not.toBeInTheDocument()
  })

  it('삭제 확정 시 projectId로 삭제 액션을 호출한다', async () => {
    const user = userEvent.setup()
    render(<DeleteProjectButton projectId="p1" projectName="테스트사업" sessionCount={0} />)
    await user.click(screen.getByRole('button', { name: '사업 삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(deleteProject).toHaveBeenCalledWith('p1')
  })
})
