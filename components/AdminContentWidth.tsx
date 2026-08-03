// 관리자 본문 너비 — 모든 페이지를 '사업 담당자 설정'처럼 풀 너비로 표시한다.
export default function AdminContentWidth({ children }: { children: React.ReactNode }) {
  return <div className="w-full">{children}</div>
}
