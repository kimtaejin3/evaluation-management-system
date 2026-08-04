import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserManagerTable, { type ManagedUser } from './UserManagerTable'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const USERS: ManagedUser[] = [
  { id: 'u1', name: '이평가', username: 'wiwon1', phone: '01011112222', affiliation: '기평원', position: '책임', tempPassword: 'abcd1234', chips: [{ label: 'A분과' }] },
  { id: 'u2', name: '박심사', username: 'wiwon2', phone: null, affiliation: null, position: null, tempPassword: 'efgh5678', chips: [] },
]

function renderTable(props: Partial<React.ComponentProps<typeof UserManagerTable>> = {}) {
  return render(
    <UserManagerTable
      users={USERS}
      roleLabel="위원"
      chipsHeader="배정 분과"
      chipsEmptyLabel="미정"
      emptyLabel="없음"
      deleteAction={vi.fn().mockResolvedValue(undefined)}
      updateAction={vi.fn().mockResolvedValue({ ok: true })}
      resetPasswordAction={vi.fn().mockResolvedValue({ ok: true, password: 'new99999' })}
      showAffiliation
      {...props}
    />,
  )
}

describe('UserManagerTable', () => {
  afterEach(() => cleanup())

  it('체크박스가 선택 모드 없이 항상 보이고, 소속/직급 열을 표시한다', () => {
    renderTable()
    // 머리글에 소속·직급
    expect(screen.getByText('소속')).toBeInTheDocument()
    expect(screen.getByText('직급')).toBeInTheDocument()
    // 각 행에 체크박스(전체선택 포함) — 클릭 전에도 존재
    expect(screen.getByText('이평가')).toBeInTheDocument()
    expect(screen.getByText('기평원')).toBeInTheDocument()
  })

  it("선택 전에는 '정보 변경'이 비활성, 1명 선택하면 활성화된다", async () => {
    const user = userEvent.setup()
    renderTable()
    const manageBtn = screen.getByRole('button', { name: '위원 정보 변경' })
    expect(manageBtn).toBeDisabled()
    await user.click(screen.getByText('이평가'))
    expect(screen.getByText('1명 선택됨')).toBeInTheDocument()
    expect(manageBtn).toBeEnabled()
  })

  it('1명 선택 후 정보 변경 → 수정 폼(이름·소속·직급)과 재발급/삭제/저장이 뜬다', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('이평가'))
    await user.click(screen.getByRole('button', { name: '위원 정보 변경' }))
    const dialog = screen.getByRole('heading', { name: '위원 정보 변경' }).closest('div')!.parentElement!
    expect(within(dialog).getByDisplayValue('이평가')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('기평원')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('책임')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '재발급' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('2명 선택 후 정보 변경 → 삭제만 가능(수정 폼 없음)', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('이평가'))
    await user.click(screen.getByText('박심사'))
    await user.click(screen.getByRole('button', { name: '위원 정보 변경' }))
    expect(screen.getByText(/삭제만 가능합니다/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('담당자 모드(showAffiliation=false)에서는 소속/직급 열이 없다', () => {
    renderTable({ showAffiliation: false, roleLabel: '담당자', chipsHeader: '참여 사업' })
    expect(screen.queryByText('소속')).not.toBeInTheDocument()
    expect(screen.queryByText('직급')).not.toBeInTheDocument()
  })

  it('showPassword=true면 비밀번호 열에 임시 비밀번호를 평문 표시한다', () => {
    renderTable({ showAffiliation: false, showPassword: true })
    expect(screen.getByText('비밀번호')).toBeInTheDocument()
    expect(screen.getByText('abcd1234')).toBeInTheDocument()
  })

  it('chips2Header가 있으면 두 번째 칩 열(참여 분과)을 렌더한다', () => {
    const withSessions = [
      { ...USERS[0], chips2: [{ label: 'A분과' }, { label: 'B분과' }] },
      { ...USERS[1], chips2: [] },
    ]
    renderTable({ showAffiliation: false, chips2Header: '참여 중인 분과', chips2EmptyLabel: '배정 없음', users: withSessions })
    expect(screen.getByText('참여 중인 분과')).toBeInTheDocument()
    expect(screen.getByText('B분과')).toBeInTheDocument()
    expect(screen.getByText('배정 없음')).toBeInTheDocument()
  })
})
