// 간사 제출 → 관리자 승인/반려 워크플로 상태 배지 (평가대상·평가위원·평가의견서 공용)
// wording: 'submit'(기본) | 'review' — 의견서처럼 간사가 '검토'하는 도메인은 검토 표현을 쓴다.
const MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "작성중", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  SUBMITTED: { label: "제출 완료", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  APPROVED: { label: "승인", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REJECTED: { label: "반려", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const REVIEW_LABEL: Record<string, string> = {
  DRAFT: "검토중",
  SUBMITTED: "검토 완료",
};

export default function ReviewStatusBadge({
  status,
  wording = "submit",
}: {
  status: string;
  wording?: "submit" | "review";
}) {
  const s = MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 ring-slate-200" };
  const label = wording === "review" ? (REVIEW_LABEL[status] ?? s.label) : s.label;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      {label}
    </span>
  );
}
