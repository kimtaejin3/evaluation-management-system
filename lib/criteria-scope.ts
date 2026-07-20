import { prisma } from './db'

// 평가항목은 과제(Project) 단위로 관리된다(과제의 모든 분과 공통).
// 분과(session) 문맥에서 평가항목을 읽을 때 소속 과제의 항목을 조회하기 위한 where 절.
// 과제 미소속 레거시 분과는 기존 세션 단위 항목으로 폴백한다.
export type CriteriaScope = { projectId: string } | { sessionId: string }

export async function criteriaScopeForSession(sessionId: string): Promise<CriteriaScope> {
  const s = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: { projectId: true },
  })
  return s?.projectId ? { projectId: s.projectId } : { sessionId }
}

// 채점 단위(ScoringUnit) 조회 — 그룹→세부항목→지표를 순서대로 읽어 unit 목록으로 변환.
// 채점 화면·집계·진행률·인쇄·엑셀이 모두 이 목록을 기준으로 동작한다.
import { buildScoringUnits, type ScoringUnit } from './criteria-units'

export async function scoringUnitsForScope(where: CriteriaScope): Promise<ScoringUnit[]> {
  const groups = await prisma.criterionGroup.findMany({
    where,
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      subitems: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          maxScore: true,
          criteria: {
            orderBy: { order: 'asc' },
            select: { id: true, name: true, maxScore: true, weight: true },
          },
        },
      },
    },
  })
  return buildScoringUnits(groups)
}

export async function scoringUnitsForSession(sessionId: string): Promise<ScoringUnit[]> {
  return scoringUnitsForScope(await criteriaScopeForSession(sessionId))
}
