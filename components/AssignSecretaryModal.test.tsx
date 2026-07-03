import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssignSecretaryModal from './AssignSecretaryModal'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/app/admin/projects/actions', () => ({
  assignSecretaryToSession: vi.fn(),
  createSecretaryAndAssignToSession: vi.fn(),
}))

const sessions = [{ id: 'sess1', name: '1분과' }]
const secretaries = [{ id: 'u1', name: '김간사', username: 'kim1' }]

async function open() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '간사 배정' }))
  return user
}

describe('AssignSecretaryModal', () => {
  afterEach(() => cleanup())

  it('트리거 클릭 전에는 모달이 없다', () => {
    render(<AssignSecretaryModal projectId="p1" sessions={sessions} secretaries={secretaries} />)
    expect(screen.queryByRole('heading', { name: '간사 배정' })).not.toBeInTheDocument()
  })

  it('기본은 기존 간사 탭이며 배정 버튼과 분과 선택을 보여준다', async () => {
    render(<AssignSecretaryModal projectId="p1" sessions={sessions} secretaries={secretaries} />)
    await open()
    expect(screen.getByRole('heading', { name: '간사 배정' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '배정' })).toBeInTheDocument()
    // 기존 간사가 옵션으로 표시
    expect(screen.getByRole('option', { name: /김간사/ })).toBeInTheDocument()
  })

  it('신규 탭으로 전환하면 이름·아이디·연락처 입력과 생성·배정 버튼이 나온다', async () => {
    render(<AssignSecretaryModal projectId="p1" sessions={sessions} secretaries={secretaries} />)
    const user = await open()
    await user.click(screen.getByRole('button', { name: '새 간사 생성' }))
    expect(screen.getByPlaceholderText('이름')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('아이디')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/연락처/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '생성·배정' })).toBeInTheDocument()
    expect(screen.getByText(/비밀번호는 연락처 끝 4자리/)).toBeInTheDocument()
  })

  it('등록된 간사가 없으면 기존 탭의 배정 버튼이 비활성화되고 안내가 표시된다', async () => {
    render(<AssignSecretaryModal projectId="p1" sessions={sessions} secretaries={[]} />)
    await open()
    expect(screen.getByRole('button', { name: '배정' })).toBeDisabled()
    expect(screen.getByText(/등록된 간사가 없습니다/)).toBeInTheDocument()
  })

  it('분과가 없으면 안내 문구만 보이고 탭이 표시되지 않는다', async () => {
    render(<AssignSecretaryModal projectId="p1" sessions={[]} secretaries={secretaries} />)
    await open()
    expect(screen.getByText('먼저 분과를 추가한 뒤 간사를 배정하세요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '기존 간사' })).not.toBeInTheDocument()
  })

  it('Esc 키로 모달이 닫힌다', async () => {
    render(<AssignSecretaryModal projectId="p1" sessions={sessions} secretaries={secretaries} />)
    const user = await open()
    expect(screen.getByRole('heading', { name: '간사 배정' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { name: '간사 배정' })).not.toBeInTheDocument()
  })
})
