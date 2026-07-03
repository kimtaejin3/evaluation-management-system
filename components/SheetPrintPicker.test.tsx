import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SheetPrintPicker from './SheetPrintPicker'

describe('SheetPrintPicker', () => {
  it('배정 위원이 없으면 안내 문구를 보여준다', () => {
    render(<SheetPrintPicker sessionId="s1" evaluators={[]} subjects={[{ id: 'sub1', name: '가나기업' }]} />)
    expect(screen.getByText('배정된 위원이 없습니다.')).toBeInTheDocument()
  })

  it('평가 대상이 없으면 안내 문구를 보여준다', () => {
    render(<SheetPrintPicker sessionId="s1" evaluators={[{ id: 'e1', name: '이심사' }]} subjects={[]} />)
    expect(screen.getByText('평가 대상이 없습니다.')).toBeInTheDocument()
  })

  it('위원 드롭다운과 기업별 인쇄 버튼을 렌더한다', () => {
    render(
      <SheetPrintPicker
        sessionId="s1"
        evaluators={[{ id: 'e1', name: '이심사' }]}
        subjects={[{ id: 'sub1', name: '가나기업' }, { id: 'sub2', name: '다라기업' }]}
      />,
    )
    expect(screen.getByRole('option', { name: '이심사' })).toBeInTheDocument()
    expect(screen.getByText('가나기업')).toBeInTheDocument()
    expect(screen.getByText('다라기업')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '인쇄' })).toHaveLength(2)
  })
})
