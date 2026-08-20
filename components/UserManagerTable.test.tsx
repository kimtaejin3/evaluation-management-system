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

// 셀이 전부 인풋이 된 뒤로 행 선택은 체크박스 셀 클릭으로 한다
const clickRowOf = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const row = screen.getByLabelText(`${name} 이름`).closest('tr')!
  await user.click(within(row).getAllByRole('cell')[0])
}

describe('UserManagerTable', () => {
  afterEach(() => cleanup())

  it('체크박스가 선택 모드 없이 항상 보이고, 소속/직급 열을 표시한다', () => {
    renderTable()
    expect(screen.getByRole('button', { name: /소속/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /직급/ })).toBeInTheDocument()
    // 이름·소속은 인라인 인풋으로 표시
    expect(screen.getByDisplayValue('이평가')).toBeInTheDocument()
    expect(screen.getByDisplayValue('기평원')).toBeInTheDocument()
  })

  it("선택 전에는 '정보 변경'이 비활성, 1명 선택하면 활성화된다", async () => {
    const user = userEvent.setup()
    renderTable()
    const manageBtn = screen.getByRole('button', { name: '위원 정보 변경' })
    expect(manageBtn).toBeDisabled()
    await clickRowOf(user, '이평가')
    expect(screen.getByText('1명 선택됨')).toBeInTheDocument()
    expect(manageBtn).toBeEnabled()
  })

  it('1명 선택 후 정보 변경 → 수정 폼과 재발급/저장이 뜬다(삭제 없음)', async () => {
    const user = userEvent.setup()
    renderTable()
    await clickRowOf(user, '이평가')
    await user.click(screen.getByRole('button', { name: '위원 정보 변경' }))
    const dialog = screen.getByRole('heading', { name: '위원 정보 변경' }).closest('div')!.parentElement!
    expect(within(dialog).getByDisplayValue('이평가')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '재발급' })).toBeInTheDocument()
    // 삭제는 모달 밖(표 하단 버튼)에서만
    expect(within(dialog).queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('담당자 모드(showAffiliation=false)에서는 소속/직급 열이 없다', () => {
    renderTable({ showAffiliation: false })
    expect(screen.queryByRole('button', { name: /소속/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /직급/ })).not.toBeInTheDocument()
  })
})

describe('인라인 편집', () => {
  afterEach(() => cleanup())

  it('이름 셀을 고쳐 블러하면 updateAction이 4개 필드로 호출된다', async () => {
    const user = userEvent.setup()
    const updateAction = vi.fn().mockResolvedValue({ ok: true })
    renderTable({ updateAction })
    const nameInput = screen.getByDisplayValue('이평가')
    await user.clear(nameInput)
    await user.type(nameInput, '이평가2')
    await user.tab() // 블러 → 저장
    expect(updateAction).toHaveBeenCalledTimes(1)
    const [id, fd] = updateAction.mock.calls[0]
    expect(id).toBe('u1')
    expect((fd as FormData).get('name')).toBe('이평가2')
    expect((fd as FormData).get('phone')).toBe('01011112222')
    expect((fd as FormData).get('affiliation')).toBe('기평원')
    expect((fd as FormData).get('position')).toBe('책임')
  })

  it('값을 바꾸지 않고 블러하면 저장하지 않는다', async () => {
    const user = userEvent.setup()
    const updateAction = vi.fn().mockResolvedValue({ ok: true })
    renderTable({ updateAction })
    await user.click(screen.getByDisplayValue('이평가'))
    await user.tab()
    expect(updateAction).not.toHaveBeenCalled()
  })
})

describe('UserManagerTable 필터·정렬', () => {
  afterEach(() => cleanup())

  it('검색어로 행을 필터하고, 초기화로 되돌린다', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.type(screen.getByPlaceholderText('이름·아이디·연락처 검색'), '이평가')
    expect(screen.getByLabelText('이평가 이름')).toBeInTheDocument()
    expect(screen.queryByLabelText('박심사 이름')).not.toBeInTheDocument()
    expect(screen.getByText(/1명 표시/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '초기화' }))
    expect(screen.getByLabelText('박심사 이름')).toBeInTheDocument()
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
    const nameHeader = screen.getByRole('button', { name: /이름/ })
    // 아이디 인풋 값으로 순서 확인 — 박심사=wiwon2 < 이평가=wiwon1
    const rowUsernames = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => (within(r).getByLabelText(/아이디$/) as HTMLInputElement).value)
    await user.click(nameHeader)
    expect(rowUsernames()).toEqual(['wiwon2', 'wiwon1'])
    await user.click(nameHeader)
    expect(rowUsernames()).toEqual(['wiwon1', 'wiwon2'])
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
    expect(screen.getByDisplayValue('이평가')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('박심사')).not.toBeInTheDocument()
  })
})

describe('pairMode — 사업×분과 짝 행 + 셀 드롭다운', () => {
  afterEach(() => cleanup())

  const pairProps = () => ({
    pairMode: true,
    chips2Header: '배정 분과',
    users: [
      {
        ...USERS[0],
        assignedProjectIds: ['p1'],
        assignedSessionIds: ['s1', 's2'],
        pairs: [
          { project: '신규사업1', projectId: 'p1', session: 'A유형', sessionId: 's1' },
          { project: '신규사업1', projectId: 'p1', session: 'B유형', sessionId: 's2' },
        ],
      },
      { ...USERS[1], assignedProjectIds: [], assignedSessionIds: [], pairs: [] },
    ],
    projectOptions: [
      { id: 'p1', label: '신규사업1' },
      { id: 'p2', label: '신규사업2' },
    ],
    setProjectsAction: vi.fn().mockResolvedValue({ ok: true }),
    sessionOptions: [
      { id: 's1', label: 'A유형', group: '신규사업1', projectId: 'p1' },
      { id: 's2', label: 'B유형', group: '신규사업1', projectId: 'p1' },
      { id: 's3', label: 'C유형', group: '신규사업2', projectId: 'p2' },
    ],
    setSessionsAction: vi.fn().mockResolvedValue({ ok: true }),
  })

  it('배정 분과마다 한 줄씩, 사람 정보는 rowSpan으로 병합되고 셀은 드롭다운이다', () => {
    renderTable(pairProps())
    expect(screen.getAllByDisplayValue('이평가')).toHaveLength(1)
    // 짝 행 드롭다운 — 이평가의 분과 셀 2개(A유형/B유형 선택됨)
    const sessionSelects = screen.getAllByLabelText('이평가 분과 선택') as HTMLSelectElement[]
    expect(sessionSelects).toHaveLength(2)
    expect(sessionSelects.map((s) => s.value)).toEqual(['s1', 's2'])
    // 헤더 제외 행 수 = 이평가 2 + 박심사 1
    expect(screen.getAllByRole('row')).toHaveLength(1 + 3)
  })

  it('분과 드롭다운을 바꾸면 그 줄의 분과만 교체해 저장한다', async () => {
    const user = userEvent.setup()
    const props = pairProps()
    renderTable(props)
    const [first] = screen.getAllByLabelText('이평가 분과 선택')
    await user.selectOptions(first, 's2') // A유형(s1) → B유형(s2)
    expect(props.setSessionsAction).toHaveBeenCalledWith('u1', ['s2'])
  })

  it('빈 행의 사업 드롭다운으로 사업을 배정한다', async () => {
    const user = userEvent.setup()
    const props = pairProps()
    renderTable(props)
    await user.selectOptions(screen.getByLabelText('박심사 사업 선택'), 'p2')
    expect(props.setProjectsAction).toHaveBeenCalledWith('u2', ['p2'])
  })
})

describe('사업 및 분과 일괄 설정', () => {
  afterEach(() => cleanup())

  const bulkProps = () => ({
    chips2Header: '배정 분과',
    users: [
      { ...USERS[0], assignedProjectIds: ['p1'], assignedSessionIds: ['s1'] },
      { ...USERS[1], assignedProjectIds: [], assignedSessionIds: [] },
    ],
    projectOptions: [
      { id: 'p1', label: '신규사업1' },
      { id: 'p2', label: '신규사업2' },
    ],
    setProjectsAction: vi.fn().mockResolvedValue({ ok: true }),
    sessionOptions: [
      { id: 's1', label: 'A유형', group: '신규사업1', projectId: 'p1' },
      { id: 's3', label: 'C유형', group: '신규사업2', projectId: 'p2' },
    ],
    setSessionsAction: vi.fn().mockResolvedValue({ ok: true }),
  })

  it("2명 선택하면 '정보 변경' 대신 '사업 및 분과 일괄 설정' 버튼이 뜬다", async () => {
    const user = userEvent.setup()
    renderTable(bulkProps())
    await clickRowOf(user, '이평가')
    expect(screen.getByRole('button', { name: '위원 정보 변경' })).toBeInTheDocument()
    await clickRowOf(user, '박심사')
    expect(screen.queryByRole('button', { name: '위원 정보 변경' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '사업 및 분과 일괄 설정' })).toBeInTheDocument()
  })

  it('같은 사업·같은 분과를 선택한 전원에게 추가로 배정한다', async () => {
    const user = userEvent.setup()
    const props = bulkProps()
    renderTable(props)
    await clickRowOf(user, '이평가')
    await clickRowOf(user, '박심사')
    await user.click(screen.getByRole('button', { name: '사업 및 분과 일괄 설정' }))
    await user.selectOptions(screen.getByLabelText('일괄 배정 사업'), 'p2')
    await user.selectOptions(screen.getByLabelText('일괄 배정 분과'), 's3')
    await user.click(screen.getByRole('button', { name: '일괄 적용' }))
    // 기존 배정 유지 + 선택 항목 추가(합집합)
    expect(props.setProjectsAction).toHaveBeenCalledWith('u1', ['p1', 'p2'])
    expect(props.setProjectsAction).toHaveBeenCalledWith('u2', ['p2'])
    expect(props.setSessionsAction).toHaveBeenCalledWith('u1', ['s1', 's3'])
    expect(props.setSessionsAction).toHaveBeenCalledWith('u2', ['s3'])
  })
})

describe('하단 삭제 버튼', () => {
  afterEach(() => cleanup())

  it('선택하면 삭제 버튼이 활성화되고, 확인 후 deleteAction이 호출된다', async () => {
    const user = userEvent.setup()
    const deleteAction = vi.fn().mockResolvedValue(undefined)
    renderTable({ deleteAction })
    const delBtn = screen
      .getAllByRole('button', { name: '삭제' })
      .find((b) => b.className.includes('border-rose-300') || b.className.includes('border-slate-200'))!
    expect(delBtn).toBeDisabled()
    await clickRowOf(user, '이평가')
    expect(delBtn).toBeEnabled()
    await user.click(delBtn)
    expect(screen.getByRole('heading', { name: '위원 삭제' })).toBeInTheDocument()
    expect(screen.getByText(/이평가.*삭제합니다/)).toBeInTheDocument()
    const confirmBtn = screen
      .getAllByRole('button', { name: '삭제' })
      .find((b) => b.className.includes('bg-indigo-600'))!
    await user.click(confirmBtn)
    expect(deleteAction).toHaveBeenCalledWith(['u1'])
  })
})

describe('페이지네이션', () => {
  afterEach(() => cleanup())

  it('10명 초과면 페이지가 나뉘고, 2페이지에 나머지가 보인다', async () => {
    const user = userEvent.setup()
    const many: ManagedUser[] = Array.from({ length: 12 }, (_, i) => ({
      id: `u${i}`, name: `사람${String(i).padStart(2, '0')}`, username: `user${i}`,
      phone: null, affiliation: null, position: null, tempPassword: null, chips: [],
    }))
    renderTable({ users: many })
    // 1페이지: 10명
    expect(screen.getAllByRole('row')).toHaveLength(1 + 10)
    expect(screen.getByText(/12명 중 1–10 표시/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2)
    expect(screen.getByLabelText('사람11 이름')).toBeInTheDocument()
  })
})

describe('낙관적 업데이트 — 설정 시 순서 불변·즉시 반영', () => {
  afterEach(() => cleanup())

  const props = () => ({
    pairMode: true,
    chips2Header: '배정 분과',
    users: [
      {
        ...USERS[0], // 이평가
        assignedProjectIds: ['p1'],
        assignedSessionIds: ['s1'],
        pairs: [{ project: '신규사업1', projectId: 'p1', session: 'A유형', sessionId: 's1' }],
      },
      {
        ...USERS[1], // 박심사
        assignedProjectIds: ['p1'],
        assignedSessionIds: ['s2'],
        pairs: [{ project: '신규사업1', projectId: 'p1', session: 'B유형', sessionId: 's2' }],
      },
    ],
    projectOptions: [
      { id: 'p1', label: '신규사업1' },
      { id: 'p2', label: '신규사업2' },
    ],
    setProjectsAction: vi.fn().mockResolvedValue({ ok: true }),
    sessionOptions: [
      { id: 's1', label: 'A유형', group: '신규사업1', projectId: 'p1' },
      { id: 's2', label: 'B유형', group: '신규사업1', projectId: 'p1' },
      { id: 's3', label: 'C유형', group: '신규사업2', projectId: 'p2' },
    ],
    setSessionsAction: vi.fn().mockResolvedValue({ ok: true }),
  })

  const rowNames = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => (within(r).queryByLabelText(/이름$/) as HTMLInputElement | null)?.value)
      .filter(Boolean)

  it('이름 정렬 상태에서 분과를 바꿔도 행 순서가 그대로고, 값이 즉시 바뀐다', async () => {
    const user = userEvent.setup()
    renderTable(props())
    // 이름 오름차순 정렬: 박심사, 이평가
    await user.click(screen.getByRole('button', { name: /이름/ }))
    expect(rowNames()).toEqual(['박심사', '이평가'])
    // 이평가의 분과를 A유형(s1) → B유형(s2)으로 변경
    const sel = screen.getByLabelText('이평가 분과 선택') as HTMLSelectElement
    await user.selectOptions(sel, 's2')
    // 즉시(낙관) 반영 — 리로드 없이 값이 바뀌고
    expect((screen.getByLabelText('이평가 분과 선택') as HTMLSelectElement).value).toBe('s2')
    // 행 순서는 절대 바뀌지 않는다
    expect(rowNames()).toEqual(['박심사', '이평가'])
  })

  it('사업을 바꾸면 짝 행이 즉시 갱신되고(새 사업 빈 짝 추가) 순서는 유지된다', async () => {
    const user = userEvent.setup()
    renderTable(props())
    await user.click(screen.getByRole('button', { name: /이름/ }))
    const before = rowNames()
    const sel = screen.getByLabelText('박심사 사업 선택') as HTMLSelectElement
    await user.selectOptions(sel, 'p2')
    // 낙관 반영: 분과(B유형)는 원 사업(p1) 소속으로 남고, 새 사업(p2)의 빈 짝 행이 즉시 추가된다
    const sels = screen.getAllByLabelText('박심사 사업 선택') as HTMLSelectElement[]
    expect(sels.map((x) => x.value).sort()).toEqual(['p1', 'p2'])
    expect(rowNames()).toEqual(before)
  })

  it('저장 실패 시 롤백되고 오류가 표시된다', async () => {
    const user = userEvent.setup()
    const p = props()
    p.setSessionsAction = vi.fn().mockResolvedValue({ ok: false, error: '마감된 분과입니다.' })
    renderTable(p)
    const sel = screen.getByLabelText('이평가 분과 선택') as HTMLSelectElement
    await user.selectOptions(sel, 's2')
    // 실패 → 원래 값으로 롤백 + 오류 문구
    expect(await screen.findByText(/마감된 분과입니다/)).toBeInTheDocument()
    expect((screen.getByLabelText('이평가 분과 선택') as HTMLSelectElement).value).toBe('s1')
  })
})

describe("사업 '참여 없음' 선택 — 짝 행 제거", () => {
  afterEach(() => cleanup())

  it('분과가 배정된 행에서 참여 없음을 고르면 분과 배정도 함께 해제되고 행이 즉시 사라진다', async () => {
    const user = userEvent.setup()
    const setProjectsAction = vi.fn().mockResolvedValue({ ok: true })
    const setSessionsAction = vi.fn().mockResolvedValue({ ok: true })
    renderTable({
      pairMode: true,
      chips2Header: '배정 분과',
      users: [
        {
          ...USERS[0],
          assignedProjectIds: ['p1'],
          assignedSessionIds: ['s1'],
          pairs: [{ project: '신규사업1', projectId: 'p1', session: 'A유형', sessionId: 's1' }],
        },
      ],
      projectOptions: [{ id: 'p1', label: '신규사업1' }],
      setProjectsAction,
      sessionOptions: [{ id: 's1', label: 'A유형', group: '신규사업1', projectId: 'p1' }],
      setSessionsAction,
    })
    await user.selectOptions(screen.getByLabelText('이평가 사업 선택'), '')
    // 사업 참여 + 그 행의 분과 배정 모두 해제
    expect(setProjectsAction).toHaveBeenCalledWith('u1', [])
    expect(setSessionsAction).toHaveBeenCalledWith('u1', [])
    // 낙관 반영: 행이 빈 상태(참여 없음 placeholder)로 즉시 전환
    expect((screen.getByLabelText('이평가 사업 선택') as HTMLSelectElement).value).toBe('')
  })

  it('같은 사업의 다른 분과가 남아 있으면 사업 참여는 유지된다', async () => {
    const user = userEvent.setup()
    const setProjectsAction = vi.fn().mockResolvedValue({ ok: true })
    const setSessionsAction = vi.fn().mockResolvedValue({ ok: true })
    renderTable({
      pairMode: true,
      chips2Header: '배정 분과',
      users: [
        {
          ...USERS[0],
          assignedProjectIds: ['p1'],
          assignedSessionIds: ['s1', 's2'],
          pairs: [
            { project: '신규사업1', projectId: 'p1', session: 'A유형', sessionId: 's1' },
            { project: '신규사업1', projectId: 'p1', session: 'B유형', sessionId: 's2' },
          ],
        },
      ],
      projectOptions: [{ id: 'p1', label: '신규사업1' }],
      setProjectsAction,
      sessionOptions: [
        { id: 's1', label: 'A유형', group: '신규사업1', projectId: 'p1' },
        { id: 's2', label: 'B유형', group: '신규사업1', projectId: 'p1' },
      ],
      setSessionsAction,
    })
    const firstProjectSel = (screen.getAllByLabelText('이평가 사업 선택') as HTMLSelectElement[])[0]
    await user.selectOptions(firstProjectSel, '')
    // A유형 배정만 해제, 사업 참여(p1)는 B유형이 남아 있어 유지
    expect(setProjectsAction).toHaveBeenCalledWith('u1', ['p1'])
    expect(setSessionsAction).toHaveBeenCalledWith('u1', ['s2'])
  })
})
