"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeReview } from "@/app/admin/sessions/actions";

// 관리자 검토 완료 버튼.
// - closed: 이미 검토 완료(잠김) → '검토 완료됨'
// - !submitted: 간사가 아직 제출 완료하지 않음 → '제출중' 표시 + 버튼 비활성
// - submitted: 검토 완료 가능
export default function CompleteReviewButton({
  sessionId,
  closed,
  submitted,
}: {
  sessionId: string;
  closed: boolean;
  submitted: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (closed) {
    return <span className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">검토 완료됨</span>;
  }

  if (!submitted) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">제출중</span>
        <button
          type="button"
          disabled
          title="간사가 제출 완료해야 검토할 수 있습니다"
          className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
        >
          검토 완료
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("이 분과의 검토를 완료하고 '완료' 상태로 전환할까요? 점수가 잠깁니다.")) return;
        start(async () => {
          await completeReview(sessionId);
          router.refresh();
        });
      }}
      className="rounded-lg bg-[var(--gov-navy)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "처리 중…" : "검토 완료"}
    </button>
  );
}
