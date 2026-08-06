import { describe, it, expect } from 'vitest'
import { autoDetectEvalAccountMapping, buildEvalAccounts } from './evaluator-account-import'

describe('evaluator-account-import', () => {
  it('테이블 머리글(이름/아이디/연락처/소속/직급)을 자동 매핑(비밀번호 없음)', () => {
    expect(autoDetectEvalAccountMapping(['이름', '아이디', '연락처', '소속', '직급'])).toEqual([
      'name',
      'username',
      'phone',
      'affiliation',
      'position',
    ])
  })

  it('동의어(위원/계정/휴대폰/기관/직위) 인식', () => {
    expect(autoDetectEvalAccountMapping(['위원', '계정', '휴대폰', '기관', '직위'])).toEqual([
      'name',
      'username',
      'phone',
      'affiliation',
      'position',
    ])
  })

  it('행을 초안으로 변환(소속/직급 포함, 빈 값 null)', () => {
    const grid = [
      ['이름', '아이디', '연락처', '소속', '직급'],
      ['이평가', 'wiwon1', '010-1234-5678', '기평원', '책임'],
      ['박심사', '', '', '', ''],
    ]
    const mapping = autoDetectEvalAccountMapping(grid[0])
    const { rows } = buildEvalAccounts(grid, mapping, { hasHeader: true })
    expect(rows).toEqual([
      { name: '이평가', username: 'wiwon1', phone: '010-1234-5678', affiliation: '기평원', position: '책임' },
      { name: '박심사', username: null, phone: null, affiliation: null, position: null },
    ])
  })

  it('이름 열 없으면 경고', () => {
    const { rows, warnings } = buildEvalAccounts([['소속'], ['기평원']], ['affiliation'], { hasHeader: true })
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/이름/)
  })
})
