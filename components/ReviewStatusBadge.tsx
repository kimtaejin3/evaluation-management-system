// 간사 제출 여부 배지 — 제출/미제출 이진 표시.
// 승인/반려 등 관리자 판단 상태는 별도의 '승인 상태' 컬럼(ApprovalBadge)에서 보여준다.
// wording: 'submit'(기본) | 'review' — 의견서처럼 간사가 '검토'하는 도메인은 검토 표현을 쓴다.
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
  const cls = submitted
    ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
    : "bg-slate-100 text-slate-500 ring-slate-200";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

// 관리자 승인 상태 배지 — '승인 상태' 컬럼용. 제출 전(DRAFT)은 대시로 표시.
const APPROVAL: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: "대기", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  APPROVED: { label: "승인", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REJECTED: { label: "반려", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export function ApprovalBadge({ status }: { status: string }) {
  const s = APPROVAL[status];
  if (!s) return <span className="text-slate-300">—</span>;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${s.cls}`}>
      {s.label}
    </span>
  );
}
