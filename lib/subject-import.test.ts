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
      { name: '(주)가나기술', businessNo: '123-45-67890', description: 'AI 솔루션' },
      { name: '다라산업', businessNo: null, description: null },
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
})
