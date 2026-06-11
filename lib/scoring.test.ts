import { describe, it, expect } from 'vitest'
import {
  gradeToValue,
  isValidScoreValue,
  computeWeightedScore,
  computeFinalScores,
  rankSubjects,
  parseGradeOptions,
  defaultGradeOptions,
} from './scoring'

describe('gradeToValue', () => {
  it('A는 만점, E는 20%', () => {
    expect(gradeToValue('A', 10)).toBe(10)
    expect(gradeToValue('E', 10)).toBeCloseTo(2)
  })
  it('알 수 없는 등급은 0', () => {
    expect(gradeToValue('Z', 10)).toBe(0)
  })
})

describe('isValidScoreValue', () => {
  it('0~maxScore 범위만 통과', () => {
    expect(isValidScoreValue(5, 10)).toBe(true)
    expect(isValidScoreValue(0, 10)).toBe(true)
    expect(isValidScoreValue(10, 10)).toBe(true)
    expect(isValidScoreValue(-1, 10)).toBe(false)
    expect(isValidScoreValue(11, 10)).toBe(false)
    expect(isValidScoreValue(NaN, 10)).toBe(false)
  })
})

describe('computeWeightedScore', () => {
  it('value × weight 의 합', () => {
    const criteria = [
      { id: 'c1', weight: 2 },
      { id: 'c2', weight: 1 },
    ]
    const rows = [
      { criterionId: 'c1', value: 5 },
      { criterionId: 'c2', value: 8 },
    ]
    expect(computeWeightedScore(rows, criteria)).toBe(18) // 5*2 + 8*1
  })
  it('누락된 항목은 0으로 취급', () => {
    const criteria = [{ id: 'c1', weight: 1 }, { id: 'c2', weight: 1 }]
    const rows = [{ criterionId: 'c1', value: 5 }]
    expect(computeWeightedScore(rows, criteria)).toBe(5)
  })
})

describe('computeFinalScores', () => {
  it('대상별 위원 평균', () => {
    const criteria = [{ id: 'c1', weight: 1 }]
    const rows = [
      { evaluatorId: 'e1', subjectId: 's1', criterionId: 'c1', value: 6 },
      { evaluatorId: 'e2', subjectId: 's1', criterionId: 'c1', value: 8 },
      { evaluatorId: 'e1', subjectId: 's2', criterionId: 'c1', value: 4 },
    ]
    const result = computeFinalScores(rows, criteria)
    expect(result.get('s1')).toBe(7) // (6+8)/2
    expect(result.get('s2')).toBe(4)
  })
  it('점수 없는 대상은 0', () => {
    const result = computeFinalScores([], [{ id: 'c1', weight: 1 }])
    expect(result.size).toBe(0)
  })
})

describe('rankSubjects', () => {
  it('내림차순 순위, 동점은 동순위', () => {
    const map = new Map([
      ['s1', 90],
      ['s2', 90],
      ['s3', 80],
    ])
    const ranked = rankSubjects(map)
    expect(ranked).toEqual([
      { subjectId: 's1', finalScore: 90, rank: 1 },
      { subjectId: 's2', finalScore: 90, rank: 1 },
      { subjectId: 's3', finalScore: 80, rank: 3 },
    ])
  })
})

describe('parseGradeOptions', () => {
  it('유효한 배열을 GradeOption[]로 복원', () => {
    const opts = parseGradeOptions([
      { label: '매우 우수', points: 30 },
      { label: '우수', points: 24 },
    ])
    expect(opts).toEqual([
      { label: '매우 우수', points: 30 },
      { label: '우수', points: 24 },
    ])
  })
  it('배열이 아니거나 비어 있으면 null', () => {
    expect(parseGradeOptions(null)).toBeNull()
    expect(parseGradeOptions('x')).toBeNull()
    expect(parseGradeOptions([])).toBeNull()
    expect(parseGradeOptions([{ label: '', points: 1 }])).toBeNull()
  })
})

describe('defaultGradeOptions', () => {
  it('배점 기준 A~E 5단계 환산', () => {
    const opts = defaultGradeOptions(30)
    expect(opts).toHaveLength(5)
    expect(opts[0].points).toBe(30) // A = 100%
    expect(opts[4].points).toBeCloseTo(6) // E = 20%
  })
})
