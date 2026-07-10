// 평가항목(그룹) 배점 합계·균형 판정 — 관리 화면 경고 및 표시용 순수 유틸
export function groupTotal(criteria: { maxScore: number }[]): number {
  return criteria.reduce((a, c) => a + (Number.isFinite(c.maxScore) ? c.maxScore : 0), 0)
}

// 평가항목 목표배점 vs 하위 평가지표 배점 합 일치 여부(부동소수 오차 허용)
export function isGroupBalanced(target: number, leafSum: number): boolean {
  return Math.abs(target - leafSum) < 1e-9
}

// 평가표 기준 만점 기본값(집계 환산 분모). 분과별로 수정 가능.
export const TOTAL_SCORE = 100

// 세션 전체 평가지표 배점 합계(모든 평가항목·세부항목의 배점 합)
export function criteriaGrandTotal(
  groups: { subitems: { criteria: { maxScore: number }[] }[] }[],
): number {
  return groups.reduce(
    (sum, g) => sum + g.subitems.reduce((s, si) => s + groupTotal(si.criteria), 0),
    0,
  )
}

// 전체 배점 합이 기준 만점과 일치하는지(부동소수 오차 허용). 기본 만점 100.
export function isTotalValid(total: number, target: number = TOTAL_SCORE): boolean {
  return Math.abs(total - target) < 1e-9
}
