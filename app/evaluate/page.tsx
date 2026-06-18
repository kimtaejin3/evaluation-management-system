import EvaluateHomeClient from './EvaluateHomeClient'

// 평가위원 홈 — 풀 CSR. 데이터는 클라이언트가 /api/evaluate/home 에서 가져온다.
export default async function EvaluateHome({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const { submitted } = await searchParams
  return <EvaluateHomeClient submitted={submitted} />
}
