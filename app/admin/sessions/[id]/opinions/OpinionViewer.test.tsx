import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import OpinionViewer from './OpinionViewer'

const items = [
  { evaluatorId: 'e1', evaluatorName: '김위원', subjectId: 's1', subjectName: '(주)알파', text: '기술력 우수' },
  { evaluatorId: 'e1', evaluatorName: '김위원', subjectId: 's2', subjectName: '(주)베타', text: '시장성 보완 필요' },
]

describe('OpinionViewer', () => {
  afterEach(() => cleanup())

  it('행마다 어떤 지원기업에 대한 종합의견인지 표시한다', () => {
    render(<OpinionViewer items={items} />)
    expect(screen.getByRole('columnheader', { name: '지원기업' })).toBeTruthy()
    const rows = screen.getAllByRole('row').slice(1) // 헤더 제외
    expect(rows[0].textContent).toContain('(주)알파')
    expect(rows[0].textContent).toContain('기술력 우수')
    expect(rows[1].textContent).toContain('(주)베타')
    expect(rows[1].textContent).toContain('시장성 보완 필요')
  })

  it('의견이 없으면 안내 문구를 보여준다', () => {
    render(<OpinionViewer items={[]} />)
    expect(screen.getByText('작성된 평가위원장 종합의견이 없습니다.')).toBeTruthy()
  })
})
