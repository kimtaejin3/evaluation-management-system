// 담당자 제출 여부 배지 — 제출/미제출 이진 표시.
// 승인/반려 등 관리자 판단 상태는 별도의 '승인 상태' 컬럼(ApprovalBadge)에서 보여준다.
// wording: 'submit'(기본) | 'review' — 의견서처럼 담당자가 '검토'하는 도메인은 검토 표현을 쓴다.
export default function ReviewStatusBadge({
  status,
  wording = "submit",
}: {
  status: string;
  wording?: "submit" | "review";
}) {
  // 제출(SUBMITTED) 또는 승인(APPROVED)이면 제출된 것. 반려(REJECTED)는 재수정 상태라 미제출.
  const submitted = status === "SUBMITTED" || status === "APPROVED";
  const label = wording === "review" ? (submitted ? "검토 완료" : "미검토") : submitted ? "제출" : "미제출";
  // 배경·테두리 없이 텍스트만 — 완료(제출·검토 완료)=검정, 미완료(미제출·미검토)=빨강.
  const cls = submitted ? "text-slate-900" : "text-rose-600";
  return <span className={`text-sm whitespace-nowrap ${cls}`}>{label}</span>;
}

// 관리자 승인 상태 배지 — '승인 상태' 컬럼용. 제출 전(DRAFT)은 대시로 표시.
// 배경·테두리 없이 색 글씨로만 구분
const APPROVAL: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: "대기", cls: "text-amber-600" },
  APPROVED: { label: "승인", cls: "text-emerald-600" },
  REJECTED: { label: "반려", cls: "text-rose-600" },
};

export function ApprovalBadge({ status }: { status: string }) {
  const s = APPROVAL[status];
  if (!s) return <span className="text-slate-300">—</span>;
  return (
    <span className={`text-sm font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span>
  );
}
