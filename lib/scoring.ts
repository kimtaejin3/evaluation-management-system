export const GRADE_RATIOS: Record<string, number> = {
  A: 1.0,
  B: 0.8,
  C: 0.6,
  D: 0.4,
  E: 0.2,
}

// 정성 등급 라벨 (A~E)
export const GRADE_LABELS: Record<string, string> = {
  A: '매우 우수',
  B: '우수',
  C: '보통',
  D: '미흡',
  E: '매우 미흡',
}

// 정성 항목의 등급(답) 옵션
export interface GradeOption {
  label: string
  points: number
}

// gradeOptions 미지정 시 기본 5단계(A~E)를 배점 기준으로 환산
export function defaultGradeOptions(maxScore: number): GradeOption[] {
  return Object.keys(GRADE_RATIOS).map((g) => ({
    label: `${g} · ${GRADE_LABELS[g]}`,
    points: Math.round(maxScore * GRADE_RATIOS[g] * 100) / 100,
  }))
}

// Json 컬럼에서 안전하게 GradeOption[] 파싱
export function parseGradeOptions(raw: unknown): GradeOption[] | null {
  if (!Array.isArray(raw)) return null
  const opts = raw
    .map((o) => (o && typeof o === 'object' ? { label: String((o as { label?: unknown }).label ?? ''), points: Number((o as { points?: unknown }).points) } : null))
    .filter((o): o is GradeOption => !!o && o.label.length > 0 && Number.isFinite(o.points))
  return opts.length > 0 ? opts : null
}

export function gradeToValue(grade: string, maxScore: number): number {
  const ratio = GRADE_RATIOS[grade] ?? 0
  return maxScore * ratio
}

export function isValidScoreValue(value: number, maxScore: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= maxScore
}

export interface WeightedCriterion {
  id: string
  weight: number
}

export interface ScoreRow {
  criterionId: string
  value: number
}

export function computeWeightedScore(
  rows: ScoreRow[],
  criteria: WeightedCriterion[],
): number {
  const byId = new Map(rows.map((r) => [r.criterionId, r.value]))
  return criteria.reduce((sum, c) => sum + (byId.get(c.id) ?? 0) * c.weight, 0)
}

export interface FullScoreRow {
  evaluatorId: string
  subjectId: string
  criterionId: string
  value: number
}

export function computeFinalScores(
  rows: FullScoreRow[],
  criteria: WeightedCriterion[],
): Map<string, number> {
  const grouped = new Map<string, Map<string, ScoreRow[]>>()
  for (const r of rows) {
    if (!grouped.has(r.subjectId)) grouped.set(r.subjectId, new Map())
    const byEval = grouped.get(r.subjectId)!
    if (!byEval.has(r.evaluatorId)) byEval.set(r.evaluatorId, [])
    byEval.get(r.evaluatorId)!.push({ criterionId: r.criterionId, value: r.value })
  }

  const result = new Map<string, number>()
  for (const [subjectId, byEval] of grouped) {
    const perEval = [...byEval.values()].map((scoreRows) =>
      computeWeightedScore(scoreRows, criteria),
    )
    const avg = perEval.reduce((a, b) => a + b, 0) / perEval.length
    result.set(subjectId, avg)
  }
  return result
}

export interface RankedSubject {
  subjectId: string
  finalScore: number
  rank: number
}

export function rankSubjects(scores: Map<string, number>): RankedSubject[] {
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const ranked: RankedSubject[] = []
  sorted.forEach(([subjectId, finalScore], index) => {
    const rank =
      index > 0 && sorted[index - 1][1] === finalScore
        ? ranked[index - 1].rank
        : index + 1
    ranked.push({ subjectId, finalScore, rank })
  })
  return ranked
}
