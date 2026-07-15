import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

afterEach(cleanup)

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
// 추가 액션은 미해결(pending)로 두어 낙관적 상태가 유지되는지 검증
vi.mock('@/app/admin/sessions/actions', () => ({
  addGroup: vi.fn(() => new Promise(() => {})),
  updateGroup: vi.fn(() => Promise.resolve()),
  deleteGroup: vi.fn(() => Promise.resolve()),
  addSubitem: vi.fn(() => new Promise(() => {})),
  addSubitemWithCriterion: vi.fn(() => new Promise(() => {})),
  updateSubitem: vi.fn(() => Promise.resolve()),
  deleteSubitem: vi.fn(() => Promise.resolve()),
  addCriterion: vi.fn(() => new Promise(() => {})),
  updateCriterion: vi.fn(() => Promise.resolve()),
  deleteCriterion: vi.fn(() => Promise.resolve()),
  updateProjectMaxScore: vi.fn(() => Promise.resolve()),
}))

import CriteriaEditor from './CriteriaEditor'
import { optReducer } from './criteria-editor-model'

describe('optReducer (평가항목 낙관적 추가)', () => {
  it('평가항목(그룹)을 임시 id로 즉시 추가', () => {
    expect(optReducer([], { kind: 'group', id: 'tmp-0', name: '기대효과', maxScore: 30 })).toEqual([
      { id: 'tmp-0', name: '기대효과', maxScore: 30, subitems: [] },
    ])
  })
  it('세부항목을 해당 그룹에 즉시 추가', () => {
    const base = [{ id: 'g1', name: '사업계획', maxScore: 10, subitems: [] }]
    expect(optReducer(base, { kind: 'subitem', id: 'tmp-1', groupId: 'g1', name: '타당성' })[0].subitems).toEqual([
      { id: 'tmp-1', name: '타당성', criteria: [] },
    ])
  })
  it('평가지표를 해당 세부항목에 즉시 추가', () => {
    const base = [{ id: 'g1', name: '사업계획', maxScore: 10, subitems: [{ id: 's1', name: '타당성', criteria: [] }] }]
    expect(
      optReducer(base, { kind: 'criterion', id: 'tmp-2', subitemId: 's1', name: '사업 타당성', maxScore: 5 })[0].subitems[0].criteria,
    ).toEqual([{ id: 'tmp-2', name: '사업 타당성', maxScore: 5 }])
  })
})

describe('CriteriaEditor 추가 UX', () => {
  it('평가항목 추가 시 입력창이 즉시 닫히고 항목이 바로 나타난다(서버 응답 전)', async () => {
    const user = userEvent.setup()
    render(<CriteriaEditor projectId="p1" groups={[]} maxScore={100} />)
    await user.click(screen.getByRole('button', { name: '+ 평가항목 추가' })) // 그룹이 없을 때는 안내 영역의 텍스트 버튼(폴백)
    await user.type(screen.getByPlaceholderText('예: 사업계획'), '기대효과')
    await user.click(screen.getByRole('button', { name: '추가' }))
    expect(screen.getByText('기대효과')).toBeInTheDocument() // 낙관적 표시
    expect(screen.queryByPlaceholderText('예: 사업계획')).toBeNull() // 입력창 즉시 닫힘
  })

  it('세부항목 추가 시 세부항목·첫 평가지표가 세트로 즉시 나타난다', async () => {
    const user = userEvent.setup()
    render(<CriteriaEditor projectId="p1" groups={[{ id: 'g1', name: '사업계획', maxScore: 10, subitems: [] }]} maxScore={100} />)
    await user.click(screen.getByRole('button', { name: '세부항목 추가' }))
    await user.type(screen.getByPlaceholderText('예: 목표 및 내용'), '타당성')
    await user.type(screen.getByPlaceholderText('예: 사업 타당성'), '시장성')
    await user.click(screen.getByRole('button', { name: '추가' }))
    expect(screen.getByText('타당성')).toBeInTheDocument() // 세부항목
    expect(screen.getByText('시장성')).toBeInTheDocument() // 첫 평가지표
    expect(screen.queryByPlaceholderText('예: 목표 및 내용')).toBeNull() // 입력창 즉시 닫힘
  })
})
