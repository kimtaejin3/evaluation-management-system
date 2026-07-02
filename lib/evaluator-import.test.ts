import { describe, it, expect } from 'vitest'
import { autoDetectEvaluatorMapping, evaluatorLooksLikeHeader, buildEvaluators } from './evaluator-import'

describe('autoDetectEvaluatorMapping', () => {
  it('성명→name, 이메일→username 매핑', () => {
    expect(autoDetectEvaluatorMapping(['성명', '이메일'])).toEqual(['name', 'username'])
  })
  it('다양한 표현(평가위원명/심사위원/아이디/계정)', () => {
    expect(autoDetectEvaluatorMapping(['평가위원명', '아이디'])).toEqual(['name', 'username'])
    expect(autoDetectEvaluatorMapping(['심사위원', '계정'])).toEqual(['name', 'username'])
  })
  it('연번/소속/직위/전문분야 등은 무시(null)', () => {
    expect(autoDetectEvaluatorMapping(['연번', '성명', '소속', '직위', '전문분야', '이메일', '비고'])).toEqual([
      null, 'name', null, null, null, 'username', null,
    ])
  })
  it('부분 포함도 너그럽게 매칭("성명자"→name), 미상 헤더는 null', () => {
    expect(autoDetectEvaluatorMapping(['성명자', '아이디'])).toEqual(['name', 'username'])
    expect(autoDetectEvaluatorMapping(['순번', '비고'])).toEqual([null, null])
  })
})

describe('evaluatorLooksLikeHeader', () => {
  it('동의어가 있으면 헤더로 간주', () => {
    expect(evaluatorLooksLikeHeader(['성명', '이메일'])).toBe(true)
    expect(evaluatorLooksLikeHeader(['홍길동', 'hong@example.com'])).toBe(false)
  })
})

describe('buildEvaluators', () => {
  const grid = [
    ['성명', '이메일', '연락처'],
    ['홍길동', 'hong@example.com', '010-1111-2222'],
    ['김평가', '', '010-3333-4444'],
    ['이심사', 'lee@example.com', '010-5555-6666'],
  ]
  const map = autoDetectEvaluatorMapping(grid[0])

  it('헤더 제외, 성명/아이디/연락처 추출 (아이디 없으면 null=자동생성)', () => {
    const { rows, warnings } = buildEvaluators(grid, map, { hasHeader: true })
    expect(warnings).toEqual([])
    expect(rows).toEqual([
      { name: '홍길동', username: 'hong@example.com', phone: '010-1111-2222' },
      { name: '김평가', username: null, phone: '010-3333-4444' },
      { name: '이심사', username: 'lee@example.com', phone: '010-5555-6666' },
    ])
  })

  it('이름 없는 행·합계 행은 스킵', () => {
    const g = [...grid, ['', 'x@y.com', '010-0000-0000'], ['합계', '', '010-9999-8888']]
    const { rows } = buildEvaluators(g, map, { hasHeader: true })
    expect(rows).toHaveLength(3)
  })

  it('같은 입력 내 중복(이메일 기준) 제거', () => {
    const g = [['성명', '이메일', '연락처'], ['홍길동', 'a@b.com', '010-1-2'], ['홍길동2', 'a@b.com', '010-3-4']]
    const { rows } = buildEvaluators(g, autoDetectEvaluatorMapping(g[0]), { hasHeader: true })
    expect(rows).toHaveLength(1)
  })

  it('성명 미매핑이면 경고 후 빈 결과', () => {
    const { rows, warnings } = buildEvaluators(grid, [null, 'username', 'phone'], { hasHeader: true })
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/성명/)
  })

  it('연락처 미매핑이면 경고 후 빈 결과(연락처 필수)', () => {
    const { rows, warnings } = buildEvaluators(grid, ['name', 'username', null], { hasHeader: true })
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/연락처/)
  })

  it('연락처 없는 행은 제외하고 경고', () => {
    const g = [['성명', '이메일', '연락처'], ['홍길동', 'h@x.com', '010-1234-5678'], ['무연락', 'no@x.com', '']]
    const { rows, warnings } = buildEvaluators(g, autoDetectEvaluatorMapping(g[0]), { hasHeader: true })
    expect(rows).toHaveLength(1)
    expect(warnings.some((w) => /연락처가 없는/.test(w))).toBe(true)
  })

  it('연락처 열 매핑·추출', () => {
    const g = [
      ['성명', '이메일', '연락처'],
      ['홍길동', 'h@x.com', '010-1234-5678'],
    ]
    const m = autoDetectEvaluatorMapping(g[0])
    expect(m).toEqual(['name', 'username', 'phone'])
    const { rows } = buildEvaluators(g, m, { hasHeader: true })
    expect(rows[0]).toEqual({ name: '홍길동', username: 'h@x.com', phone: '010-1234-5678' })
  })
})
