// 위원장 대상별 화면의 순수 계산 — DB 접근 없이 테스트 가능한 로직만 모은다.

export type ChairEvalState = 'none' | 'partial' | 'complete'

// 입력 상태 — 전 채점 단위를 입력했을 때만 complete, 일부면 partial, 없으면 none.
// 채점 단위가 0개인 분과에서는 complete가 될 수 없다(집계할 것이 없음).
export function chairEvalState(filledUnits: number, totalUnits: number): ChairEvalState {
  if (totalUnits > 0 && filledUnits >= totalUnits) return 'complete'
  return filledUnits > 0 ? 'partial' : 'none'
}

// 제출 여부 — 제출(SUBMITTED)·승인(APPROVED)만 제출로 본다.
// 반려(REJECTED)는 위원이 다시 작성하는 상태라 미제출로 취급한다.
export function isSubmitted(status: string | null | undefined): boolean {
  return status === 'SUBMITTED' || status === 'APPROVED'
}

// 정렬된 대상 id 목록에서 현재 대상의 앞뒤 대상 id
export function neighborSubjects(
  ids: string[],
  currentId: string,
): { prevSubjectId: string | null; nextSubjectId: string | null } {
  const i = ids.indexOf(currentId)
  if (i === -1) return { prevSubjectId: null, nextSubjectId: null }
  return {
    prevSubjectId: i > 0 ? ids[i - 1] : null,
    nextSubjectId: i < ids.length - 1 ? ids[i + 1] : null,
  }
}
