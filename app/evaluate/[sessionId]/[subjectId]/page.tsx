import ScoreSheetClient from './ScoreSheetClient'

// 평가위원 점수 입력 — 풀 CSR. 데이터는 클라이언트가 /api/evaluate/sheet 에서 가져온다.
export default async function ScoreSheet({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string; subjectId: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const { sessionId, subjectId } = await params
  const { step } = await searchParams
  return <ScoreSheetClient sessionId={sessionId} subjectId={subjectId} initialStep={step} />
}
