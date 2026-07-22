import ChairSubjectClient from './ChairSubjectClient'

// 위원장 대상별 종합의견 — 풀 CSR.
// 데이터/권한은 /api/evaluate/chair/subject 에서 처리(위원장 아니면 403 → /evaluate 리다이렉트).
export default async function ChairSubjectPage({
  params,
}: {
  params: Promise<{ sessionId: string; subjectId: string }>
}) {
  const { sessionId, subjectId } = await params
  return <ChairSubjectClient sessionId={sessionId} subjectId={subjectId} />
}
