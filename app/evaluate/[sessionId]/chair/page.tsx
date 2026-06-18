import ChairClient from './ChairClient'

// 위원장 총괄표 — 풀 CSR. 데이터/권한은 /api/evaluate/chair 에서 처리(위원장 아니면 403→리다이렉트).
export default async function ChairPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  return <ChairClient sessionId={sessionId} />
}
