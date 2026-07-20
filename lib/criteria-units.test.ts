import { describe, it, expect } from 'vitest'
import { buildScoringUnits, scoreUnitId, subitemTotal, type UnitGroup } from './criteria-units'
import { computeFinalScores } from './scoring'

const groups: UnitGroup[] = [
  {
    id: 'g1',
    name: '사업계획',
    subitems: [
      // 지표별 모드 — 지표 각각이 unit
      {
        id: 's1',
        name: '목표 및 내용',
        maxScore: null,
        criteria: [
          { id: 'c1', name: '타당성', maxScore: 10 },
          { id: 'c2', name: '구체성', maxScore: 20 },
        ],
      },
      // 통합 모드 — 세부항목이 unit 1개(30점), 지표는 설명용
      {
        id: 's2',
        name: '추진 체계',
        maxScore: 30,
        criteria: [
          { id: 'c3', name: '지표A', maxScore: 0 },
          { id: 'c4', name: '지표B', maxScore: 0 },
          { id: 'c5', name: '지표C', maxScore: 0 },
        ],
      },
    ],
  },
]

describe('buildScoringUnits', () => {
  it('지표별 세부항목은 지표마다, 통합 세부항목은 1개의 unit을 만든다', () => {
    const units = buildScoringUnits(groups)
    expect(units.map((u) => u.unitId)).toEqual(['c1', 'c2', 's2'])
    expect(units[2]).toMatchObject({
      kind: 'subitem',
      label: '추진 체계',
      indicators: ['지표A', '지표B', '지표C'],
      maxScore: 30,
    })
  })

  it('통합 배점 0점도 통합 모드로 취급한다(0 ≠ null)', () => {
    const units = buildScoringUnits([
      { id: 'g', name: 'g', subitems: [{ id: 's', name: 's', maxScore: 0, criteria: [] }] },
    ])
    expect(units).toHaveLength(1)
    expect(units[0].kind).toBe('subitem')
  })
})

describe('scoreUnitId / subitemTotal', () => {
  it('점수 행을 criterionId 우선, 없으면 subitemId로 매핑한다', () => {
    expect(scoreUnitId({ criterionId: 'c1', subitemId: null })).toBe('c1')
    expect(scoreUnitId({ criterionId: null, subitemId: 's2' })).toBe('s2')
  })
  it('세부항목 배점: 통합이면 통합 배점, 지표별이면 지표 합', () => {
    expect(subitemTotal(groups[0].subitems[0])).toBe(30) // 10+20
    expect(subitemTotal(groups[0].subitems[1])).toBe(30) // 통합 30
  })
})

describe('units + computeFinalScores 통합', () => {
  it('통합·지표별 혼합 점수가 unit 키로 함께 집계된다', () => {
    const units = buildScoringUnits(groups)
    const weights = units.map((u) => ({ id: u.unitId, weight: u.weight }))
    // 위원 e1: c1=10, c2=20, s2(통합)=25 → 총 55
    const rows = [
      { evaluatorId: 'e1', subjectId: 'sub1', criterionId: 'c1', value: 10 },
      { evaluatorId: 'e1', subjectId: 'sub1', criterionId: 'c2', value: 20 },
      { evaluatorId: 'e1', subjectId: 'sub1', criterionId: scoreUnitId({ criterionId: null, subitemId: 's2' }), value: 25 },
    ]
    const final = computeFinalScores(rows, weights)
    expect(final.get('sub1')).toBe(55)
  })
})
