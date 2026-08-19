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

  it('1명 선택 후 정보 변경 → 수정 폼(이름·소속·직급)과 재발급/저장이 뜬다(삭제 없음)', async () => {
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
    // 삭제는 모달 밖(표 하단 버튼·행 아이콘)에서만
    expect(within(dialog).queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('2명 선택 후 정보 변경 → 각자 수정(저장) 가능, 모달에 삭제 없음', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('이평가'))
    await user.click(screen.getByText('박심사'))
    await user.click(screen.getByRole('button', { name: '위원 정보 변경' }))
    // 여러 명이어도 수정 폼(저장 버튼)이 있고, 모달 안에는 삭제가 없다
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2명 삭제' })).not.toBeInTheDocument()
    // 이름 칩으로 활성 사용자를 전환할 수 있다
    expect(screen.getByRole('button', { name: /박심사/ })).toBeInTheDocument()
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

describe('UserManagerTable 필터·정렬', () => {
  afterEach(() => cleanup())

  it('검색어로 행을 필터하고, 초기화로 되돌린다', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.type(screen.getByPlaceholderText('이름·아이디·연락처 검색'), '이평가')
    expect(screen.getByText('이평가')).toBeInTheDocument()
    expect(screen.queryByText('박심사')).not.toBeInTheDocument()
    expect(screen.getByText(/1명 표시/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '초기화' }))
    expect(screen.getByText('박심사')).toBeInTheDocument()
  })

  it('일치하는 행이 없으면 "검색 결과가 없습니다."를 보여준다', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.type(screen.getByPlaceholderText('이름·아이디·연락처 검색'), '없는사람')
    expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument()
  })

  it('이름 헤더 클릭으로 오름/내림차순 정렬을 토글한다', async () => {
    const user = userEvent.setup()
    renderTable()
    const nameHeader = screen.getByRole('button', { name: /이름 정렬|이름/ })
    const rowNames = () =>
      screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1].textContent)
    await user.click(nameHeader) // 오름차순: 박심사 < 이평가
    expect(rowNames()).toEqual(['박심사', '이평가'])
    await user.click(nameHeader) // 내림차순
    expect(rowNames()).toEqual(['이평가', '박심사'])
  })

  it('사업 필터 셀렉트로 참여 사업 기준 필터한다', async () => {
    const user = userEvent.setup()
    renderTable({
      users: [
        { ...USERS[0], assignedProjectIds: ['p1'] },
        { ...USERS[1], assignedProjectIds: [] },
      ],
      projectOptions: [{ id: 'p1', label: '2027 시범사업' }],
      setProjectsAction: vi.fn().mockResolvedValue({ ok: true }),
    })
    await user.selectOptions(screen.getByLabelText('사업 필터'), 'p1')
    expect(screen.getByText('이평가')).toBeInTheDocument()
    expect(screen.queryByText('박심사')).not.toBeInTheDocument()
  })
})

describe('UserManagerTable 미참여·분과 필터', () => {
  afterEach(() => cleanup())

  const usersWithAssign: ManagedUser[] = [
    { ...USERS[0], assignedProjectIds: ['p1'], assignedSessionIds: ['s1'], chips2: [{ label: 'A분과' }] },
    { ...USERS[1], assignedProjectIds: [], assignedSessionIds: [], chips2: [] },
  ]
  const assignProps = {
    users: usersWithAssign,
    chips2Header: '배정 분과',
    projectOptions: [{ id: 'p1', label: '2027 시범사업' }],
    setProjectsAction: vi.fn().mockResolvedValue({ ok: true }),
    sessionOptions: [{ id: 's1', label: 'A분과', group: '2027 시범사업', projectId: 'p1' }],
    setSessionsAction: vi.fn().mockResolvedValue({ ok: true }),
  }

  it("사업 필터의 '참여 없음' 옵션으로 미참여자만 남긴다", async () => {
    const user = userEvent.setup()
    renderTable(assignProps)
    await user.selectOptions(screen.getByLabelText('사업 필터'), '__none__')
    expect(screen.queryByText('이평가')).not.toBeInTheDocument()
    expect(screen.getByText('박심사')).toBeInTheDocument()
  })

  it('분과 필터로 특정 분과 배정자만, 미배정 옵션으로 미배정자만 남긴다', async () => {
    const user = userEvent.setup()
    renderTable(assignProps)
    const sel = screen.getByLabelText('분과 필터')
    await user.selectOptions(sel, 's1')
    expect(screen.getByText('이평가')).toBeInTheDocument()
    expect(screen.queryByText('박심사')).not.toBeInTheDocument()
    await user.selectOptions(sel, '__none__')
    expect(screen.queryByText('이평가')).not.toBeInTheDocument()
    expect(screen.getByText('박심사')).toBeInTheDocument()
  })
})

describe('사업 및 분과 일괄 설정', () => {
  afterEach(() => cleanup())

  const bulkProps = () => ({
    users: [
      { ...USERS[0], assignedProjectIds: ['p1'], assignedSessionIds: ['s1'] },
      { ...USERS[1], assignedProjectIds: [], assignedSessionIds: [] },
    ],
    chips2Header: '배정 분과',
    projectOptions: [
      { id: 'p1', label: '2027 시범사업' },
      { id: 'p2', label: '2028 본사업' },
    ],
    setProjectsAction: vi.fn().mockResolvedValue({ ok: true }),
    sessionOptions: [
      { id: 's1', label: 'A분과', group: '2027 시범사업', projectId: 'p1' },
      { id: 's2', label: 'B분과', group: '2028 본사업', projectId: 'p2' },
    ],
    setSessionsAction: vi.fn().mockResolvedValue({ ok: true }),
  })

  it("2명 선택하면 '정보 변경' 대신 '사업 및 분과 일괄 설정' 버튼이 뜬다", async () => {
    const user = userEvent.setup()
    renderTable(bulkProps())
    await user.click(screen.getByText('이평가'))
    expect(screen.getByRole('button', { name: '위원 정보 변경' })).toBeInTheDocument()
    await user.click(screen.getByText('박심사'))
    expect(screen.queryByRole('button', { name: '위원 정보 변경' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '사업 및 분과 일괄 설정' })).toBeInTheDocument()
  })

  it('모달: 사업은 일괄 체크(합집합 초기값), 사람별 분과 드롭다운이 뜬다', async () => {
    const user = userEvent.setup()
    renderTable(bulkProps())
    await user.click(screen.getByText('이평가'))
    await user.click(screen.getByText('박심사'))
    await user.click(screen.getByRole('button', { name: '사업 및 분과 일괄 설정' }))
    // 사업 합집합(p1)이 미리 체크됨
    expect(screen.getByRole('checkbox', { name: '2027 시범사업' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '2028 본사업' })).not.toBeChecked()
    // 사람별 드롭다운
    expect(screen.getByLabelText('이평가 분과 선택')).toHaveValue('s1')
    expect(screen.getByLabelText('박심사 분과 선택')).toHaveValue('')
  })

  it('저장 시 전원 사업 일괄 적용 + 분과는 바꾼 사람만 저장된다', async () => {
    const user = userEvent.setup()
    const props = bulkProps()
    renderTable(props)
    await user.click(screen.getByText('이평가'))
    await user.click(screen.getByText('박심사'))
    await user.click(screen.getByRole('button', { name: '사업 및 분과 일괄 설정' }))
    // 사업 하나 더 체크 + 박심사에게 분과 배정
    await user.click(screen.getByRole('checkbox', { name: '2028 본사업' }))
    await user.selectOptions(screen.getByLabelText('박심사 분과 선택'), 's2')
    await user.click(screen.getByRole('button', { name: '저장' }))
    // 사업: 두 사람 모두 p1+p2
    expect(props.setProjectsAction).toHaveBeenCalledWith('u1', expect.arrayContaining(['p1', 'p2']))
    expect(props.setProjectsAction).toHaveBeenCalledWith('u2', expect.arrayContaining(['p1', 'p2']))
    // 분과: 바꾼 박심사만 호출, 이평가는 그대로라 호출 없음
    expect(props.setSessionsAction).toHaveBeenCalledTimes(1)
    expect(props.setSessionsAction).toHaveBeenCalledWith('u2', ['s2'])
  })
})

describe('pairMode(평가위원) — 사업×분과 짝 행', () => {
  afterEach(() => cleanup())

  it('배정 분과마다 한 줄씩, 사람 정보는 rowSpan으로 병합된다', () => {
    renderTable({
      pairMode: true,
      chips2Header: '배정 분과',
      users: [
        {
          ...USERS[0],
          pairs: [
            { project: '신규사업1', session: 'A유형' },
            { project: '신규사업1', session: 'B유형' },
            { project: '신규사업2', session: null },
          ],
        },
      ],
    })
    // 3개 짝 행이지만 이름 셀은 1개(rowSpan)
    expect(screen.getAllByText('이평가')).toHaveLength(1)
    expect(screen.getByText('A유형')).toBeInTheDocument()
    expect(screen.getByText('B유형')).toBeInTheDocument()
    expect(screen.getAllByText('신규사업1')).toHaveLength(2)
    expect(screen.getByText('신규사업2')).toBeInTheDocument()
    // 헤더 제외 데이터 행 수 = 3
    expect(screen.getAllByRole('row')).toHaveLength(1 + 3)
  })

  it('짝 행 어느 줄을 클릭해도 그 사람이 선택된다', async () => {
    const user = userEvent.setup()
    renderTable({
      pairMode: true,
      chips2Header: '배정 분과',
      users: [
        { ...USERS[0], pairs: [{ project: '신규사업1', session: 'A유형' }, { project: '신규사업1', session: 'B유형' }] },
      ],
    })
    await user.click(screen.getByText('B유형'))
    expect(screen.getByText('1명 선택됨')).toBeInTheDocument()
  })
})

describe('하단 삭제 버튼', () => {
  afterEach(() => cleanup())

  it('선택하면 삭제 버튼이 활성화되고, 확인 후 deleteAction이 호출된다', async () => {
    const user = userEvent.setup()
    const deleteAction = vi.fn().mockResolvedValue(undefined)
    renderTable({ deleteAction })
    // 행 아이콘(삭제)와 구분 — 하단 일괄 삭제 버튼은 rose 테두리 스타일
    const delBtn = screen
      .getAllByRole('button', { name: '삭제' })
      .find((b) => b.className.includes('border-rose-300') || b.className.includes('border-slate-200'))!
    expect(delBtn).toBeDisabled()
    await user.click(screen.getByText('이평가'))
    expect(delBtn).toBeEnabled()
    await user.click(delBtn)
    // 확인 모달
    expect(screen.getByRole('heading', { name: '위원 삭제' })).toBeInTheDocument()
    expect(screen.getByText(/이평가.*삭제합니다/)).toBeInTheDocument()
    const confirmBtn = screen
      .getAllByRole('button', { name: '삭제' })
      .find((b) => b.className.includes('bg-indigo-600'))!
    await user.click(confirmBtn)
    expect(deleteAction).toHaveBeenCalledWith(['u1'])
  })
})

describe('행 수정·삭제 아이콘', () => {
  afterEach(() => cleanup())

  it('수정 아이콘 → 그 사람의 정보 변경 모달, 삭제 아이콘 → 확인 후 해당 1명 삭제', async () => {
    const user = userEvent.setup()
    const deleteAction = vi.fn().mockResolvedValue(undefined)
    renderTable({ deleteAction })
    // 수정 아이콘
    await user.click(screen.getAllByRole('button', { name: '수정' })[0])
    expect(screen.getByRole('heading', { name: '위원 정보 변경' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('이평가')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '닫기' }))
    // 삭제 아이콘 → 확인 모달
    await user.click(screen.getAllByRole('button', { name: '삭제' })[0])
    expect(screen.getByRole('heading', { name: '위원 삭제' })).toBeInTheDocument()
    const confirmBtn = screen
      .getAllByRole('button', { name: /삭제/ })
      .find((b) => b.className.includes('bg-rose-600'))!
    await user.click(confirmBtn)
    expect(deleteAction).toHaveBeenCalledWith(['u1'])
  })
})
