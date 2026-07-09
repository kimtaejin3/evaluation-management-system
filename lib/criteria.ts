// 평가항목(그룹) 배점 합계·균형 판정 — 관리 화면 경고 및 표시용 순수 유틸
export function groupTotal(criteria: { maxScore: number }[]): number {
  return criteria.reduce((a, c) => a + (Number.isFinite(c.maxScore) ? c.maxScore : 0), 0)
}

// 평가항목 목표배점 vs 하위 평가지표 배점 합 일치 여부(부동소수 오차 허용)
export function isGroupBalanced(target: number, leafSum: number): boolean {
  return Math.abs(target - leafSum) < 1e-9
}

// 평가표 전체 배점 합계는 반드시 100이어야 한다(집계 환산의 기준점).
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

// 전체 배점 합이 100인지(부동소수 오차 허용)
export function isTotalValid(total: number): boolean {
  return Math.abs(total - TOTAL_SCORE) < 1e-9
}
