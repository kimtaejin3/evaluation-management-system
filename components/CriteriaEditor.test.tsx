import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CriteriaEditor from './CriteriaEditor'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/app/admin/sessions/actions', () => ({
  addGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  addSubitem: vi.fn(),
  addSubitemWithCriterion: vi.fn(),
  updateSubitem: vi.fn(),
  deleteSubitem: vi.fn(),
  addCriterion: vi.fn(),
  updateCriterion: vi.fn(),
  deleteCriterion: vi.fn(),
  updateSessionMaxScore: vi.fn(),
}))

const groups = [
  {
    id: 'g1',
    name: '사업계획',
    maxScore: 30,
    subitems: [
      { id: 'sub1', name: '타당성', criteria: [{ id: 'c1', name: '시장성', maxScore: 30 }] },
    ],
  },
]

describe('CriteriaEditor', () => {
  afterEach(() => cleanup())

  it('편집 모드에서 마지막 평가항목 옆 추가 버튼과 항목명을 보여준다', () => {
    render(<CriteriaEditor sessionId="s1" groups={groups} maxScore={100} />)
    expect(screen.getByRole('button', { name: '평가항목 추가' })).toBeInTheDocument()
    expect(screen.getByText('사업계획')).toBeInTheDocument()
  })

  it('평가항목 추가 클릭 시 항목명·목표배점 입력 폼이 열린다', async () => {
    const user = userEvent.setup()
    render(<CriteriaEditor sessionId="s1" groups={groups} maxScore={100} />)
    await user.click(screen.getByRole('button', { name: '평가항목 추가' }))
    expect(screen.getByPlaceholderText('예: 사업계획')).toBeInTheDocument()
  })

  it('평가항목이 없으면 안내 문구를 보여준다', () => {
    render(<CriteriaEditor sessionId="s1" groups={[]} maxScore={100} />)
    expect(screen.getByText(/등록된 평가항목이 없습니다/)).toBeInTheDocument()
  })
})
