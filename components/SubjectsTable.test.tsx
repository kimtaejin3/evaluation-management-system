import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubjectsTable, { type SubjectRow } from './SubjectsTable'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/admin/sessions/actions', () => ({
  editSubject: vi.fn().mockResolvedValue(undefined),
  deleteSubject: vi.fn().mockResolvedValue(undefined),
  deleteSubjectDocument: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/components/SubjectUploadForm', () => ({ default: () => <div data-testid="upload-form" /> }))

const ROWS: SubjectRow[] = [
  { id: 's1', companyId: 'c1', name: '시연기업 A', status: 'PENDING', rejectionReason: null, businessNo: '123', region: '서울', leadResearcher: '홍길동', description: null, documents: [] },
  { id: 's2', companyId: 'c2', name: '시연기업 B', status: 'APPROVED', rejectionReason: null, businessNo: null, region: '부산', leadResearcher: '김연구', description: null, documents: [] },
]

const renderTable = (canEdit = true) =>
  render(<SubjectsTable sessionId="sess1" subjects={ROWS} canEdit={canEdit} />)

describe('SubjectsTable', () => {
  afterEach(() => cleanup())

  it('canEdit면 체크박스와 정보 변경 버튼이 있고, 관리(수정/제외) 열은 없다', () => {
    renderTable(true)
    expect(screen.getByRole('button', { name: '평가 대상 정보 변경' })).toBeDisabled()
    expect(screen.queryByText('제외')).not.toBeInTheDocument()
    expect(screen.getByText('시연기업 A')).toBeInTheDocument()
  })

  it('행(기업명) 클릭으로는 선택되지 않고 체크박스 클릭으로만 선택된다', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('시연기업 A'))
    expect(screen.queryByText('1개 선택됨')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '시연기업 A 선택' }))
    expect(screen.getByText('1개 선택됨')).toBeInTheDocument()
  })

  it('1개 선택 후 정보 변경 → 수정 폼(지역·연구책임자)과 삭제 버튼이 뜬다', async () => {
    const user = userEvent.setup()
    renderTable(true)
    await user.click(screen.getByRole('button', { name: '시연기업 A 선택' }))
    expect(screen.getByText('1개 선택됨')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '평가 대상 정보 변경' }))
    expect(screen.getByDisplayValue('서울')).toBeInTheDocument()
    expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '정보 저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('2개 선택 후 정보 변경 → 삭제만(수정 폼 없음)', async () => {
    const user = userEvent.setup()
    renderTable(true)
    await user.click(screen.getByRole('button', { name: '시연기업 A 선택' }))
    await user.click(screen.getByRole('button', { name: '시연기업 B 선택' }))
    await user.click(screen.getByRole('button', { name: '평가 대상 정보 변경' }))
    expect(screen.getByText(/삭제만 가능합니다/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '정보 저장' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('canEdit=false면 체크박스·정보 변경 버튼이 없다(서류 보기만)', () => {
    renderTable(false)
    expect(screen.queryByRole('button', { name: '평가 대상 정보 변경' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '전체 선택' })).not.toBeInTheDocument()
    // 서류 열은 '제출 서류 (n)' 버튼으로 남는다(행마다 하나)
    expect(screen.getAllByRole('button', { name: /제출 서류/ }).length).toBe(ROWS.length)
  })
})
