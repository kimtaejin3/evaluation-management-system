// 평가항목(그룹) 배점 합계·균형 판정 — 관리 화면 경고 및 표시용 순수 유틸
export function groupTotal(criteria: { maxScore: number }[]): number {
  return criteria.reduce((a, c) => a + (Number.isFinite(c.maxScore) ? c.maxScore : 0), 0)
}

// 평가항목 목표배점 vs 하위 평가지표 배점 합 일치 여부(부동소수 오차 허용)
export function isGroupBalanced(target: number, leafSum: number): boolean {
  return Math.abs(target - leafSum) < 1e-9
}
