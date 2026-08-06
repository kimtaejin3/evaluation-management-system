// 관리자 본문 너비 — 모든 페이지를 '사업 담당자 설정'처럼 풀 너비로 표시한다.
export default function AdminContentWidth({ children }: { children: React.ReactNode }) {
  // flex-1 + flex-col: 본문이 남은 높이를 채워, 페이지가 하단 고정(mt-auto) 배치를 쓸 수 있게 한다.
  return <div className="flex w-full flex-1 flex-col">{children}</div>
}
