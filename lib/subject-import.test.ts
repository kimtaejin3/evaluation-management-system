import { describe, it, expect } from 'vitest'
import { autoDetectSubjectMapping, subjectLooksLikeHeader, buildSubjects } from './subject-import'

describe('autoDetectSubjectMapping', () => {
  it('기업명/사업자번호/설명 매핑', () => {
    expect(autoDetectSubjectMapping(['기업명', '사업자번호', '설명'])).toEqual(['name', 'businessNo', 'description'])
  })
  it('표현 변형(업체명/상호/사업자등록번호/개요)', () => {
    expect(autoDetectSubjectMapping(['업체명', '사업자등록번호', '사업개요'])).toEqual(['name', 'businessNo', 'description'])
    expect(autoDetectSubjectMapping(['상호', '등록번호'])).toEqual(['name', 'businessNo'])
  })
  it('연번/담당자 등은 무시', () => {
    expect(autoDetectSubjectMapping(['연번', '기업명', '담당자'])).toEqual([null, 'name', null])
  })
})

describe('subjectLooksLikeHeader', () => {
  it('동의어 있으면 헤더', () => {
    expect(subjectLooksLikeHeader(['기업명', '사업자번호'])).toBe(true)
    expect(subjectLooksLikeHeader(['가나기술', '123-45-67890'])).toBe(false)
  })
})

describe('buildSubjects', () => {
  const grid = [
    ['기업명', '사업자번호', '설명'],
    ['(주)가나기술', '123-45-67890', 'AI 솔루션'],
    ['다라산업', '', ''],
    ['합계', '', ''],
  ]
  const map = autoDetectSubjectMapping(grid[0])

  it('헤더 제외, 기업 추출 — 합계 행 스킵', () => {
    const { rows, warnings } = buildSubjects(grid, map, { hasHeader: true })
    expect(warnings).toEqual([])
    expect(rows).toEqual([
      { name: '(주)가나기술', businessNo: '123-45-67890', region: null, leadResearcher: null, description: 'AI 솔루션' },
      { name: '다라산업', businessNo: null, region: null, leadResearcher: null, description: null },
    ])
  })

  it('같은 입력 내 중복 기업명 제거', () => {
    const g = [['기업명'], ['가나'], ['가나']]
    const { rows } = buildSubjects(g, autoDetectSubjectMapping(g[0]), { hasHeader: true })
    expect(rows).toHaveLength(1)
  })

  it('기업명 미매핑이면 경고 후 빈 결과', () => {
    const { rows, warnings } = buildSubjects(grid, [null, 'businessNo', 'description'], { hasHeader: true })
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/기업명/)
  })

  it('지역·연구책임자 열을 자동 매핑하고 추출한다', () => {
    const g = [
      ['기업명', '사업자번호', '지역', '연구책임자'],
      ['(주)가나기술', '123-45-67890', '대전', '홍길동'],
      ['다라산업', '', '', ''],
    ]
    const map = autoDetectSubjectMapping(g[0])
    expect(map).toEqual(['name', 'businessNo', 'region', 'leadResearcher'])
    const { rows } = buildSubjects(g, map, { hasHeader: true })
    expect(rows[0]).toEqual({ name: '(주)가나기술', businessNo: '123-45-67890', region: '대전', leadResearcher: '홍길동', description: null })
    expect(rows[1]).toMatchObject({ region: null, leadResearcher: null })
  })
})
