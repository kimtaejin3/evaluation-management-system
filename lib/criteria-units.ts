// 채점 단위(ScoringUnit) — 평가표에서 점수를 입력·집계하는 실제 단위(순수 모듈).
// 지표별 세부항목: 지표 각각이 unit 1개(unitId = criterion.id)
// 통합(퉁) 세부항목: 세부항목이 unit 1개(unitId = subitem.id, indicators = 지표명 목록)
// Score 행은 criterionId 또는 subitemId 중 하나로 unit에 매핑된다.

export interface UnitCriterion {
  id: string
  name: string
  maxScore: number
  weight?: number
}

export interface UnitSubitem {
  id: string
  name: string
  // null = 지표별 배점 모드, 값 있음 = 세부항목 통합 배점(퉁 채점)
  maxScore: number | null
  criteria: UnitCriterion[]
}

export interface UnitGroup {
  id: string
  name: string
  subitems: UnitSubitem[]
}

export interface ScoringUnit {
  unitId: string
  kind: 'criterion' | 'subitem'
  groupId: string
  groupName: string
  subitemId: string
  subitemName: string
  // 지표별: 지표명, 통합: 세부항목명
  label: string
  // 통합 모드일 때 설명용 지표명 목록(지표별 모드는 빈 배열)
  indicators: string[]
  maxScore: number
  weight: number
}

export function buildScoringUnits(groups: UnitGroup[]): ScoringUnit[] {
  const units: ScoringUnit[] = []
  for (const g of groups) {
    for (const s of g.subitems) {
      if (s.maxScore != null) {
        units.push({
          unitId: s.id,
          kind: 'subitem',
          groupId: g.id,
          groupName: g.name,
          subitemId: s.id,
          subitemName: s.name,
          label: s.name,
          indicators: s.criteria.map((c) => c.name),
          maxScore: s.maxScore,
          weight: 1,
        })
      } else {
        for (const c of s.criteria) {
          units.push({
            unitId: c.id,
            kind: 'criterion',
            groupId: g.id,
            groupName: g.name,
            subitemId: s.id,
            subitemName: s.name,
            label: c.name,
            indicators: [],
            maxScore: c.maxScore,
            weight: c.weight ?? 1,
          })
        }
      }
    }
  }
  return units
}

// Score 행 → unit 키. 지표별 점수는 criterionId, 통합 점수는 subitemId에 기록된다.
export function scoreUnitId(s: { criterionId?: string | null; subitemId?: string | null }): string {
  return s.criterionId ?? s.subitemId ?? ''
}

// 세부항목의 배점(모드 무관): 통합이면 통합 배점, 지표별이면 지표 배점 합
export function subitemTotal(s: { maxScore?: number | null; criteria: { maxScore: number }[] }): number {
  return s.maxScore ?? s.criteria.reduce((a, c) => a + (Number.isFinite(c.maxScore) ? c.maxScore : 0), 0)
}
