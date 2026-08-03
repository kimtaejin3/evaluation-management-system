"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSessionForReview, cancelSubmitSessionForReview } from "@/app/admin/sessions/actions";

// 담당자 제출 완료 버튼.
// - closed: 관리자 검토까지 끝남(잠김) → '검토 완료됨'
// - submitted: 제출 완료 상태 → '제출 완료됨' + 제출 취소(검토 완료 전까지)
// - 그 외: '제출 완료' 가능
export default function SubmitReviewButton({
  sessionId,
  submitted,
  closed,
}: {
  sessionId: string;
  submitted: boolean;
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (closed) {
    return <span className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">검토 완료됨</span>;
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">제출 완료됨</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("제출을 취소하고 다시 수정 상태로 되돌릴까요?")) return;
            start(async () => {
              await cancelSubmitSessionForReview(sessionId);
              router.refresh();
            });
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "처리 중…" : "제출 취소"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("집계 결과를 제출 완료할까요? 관리자가 검토 후 최종 완료합니다.")) return;
        start(async () => {
          await submitSessionForReview(sessionId);
          router.refresh();
        });
      }}
      className="rounded-lg bg-[var(--gov-navy)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "처리 중…" : "제출 완료"}
    </button>
  );
}
