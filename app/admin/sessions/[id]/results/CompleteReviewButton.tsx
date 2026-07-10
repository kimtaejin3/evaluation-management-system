"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeReview } from "@/app/admin/sessions/actions";

export default function CompleteReviewButton({ sessionId, closed }: { sessionId: string; closed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (closed) {
    return <span className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">검토 완료됨</span>;
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
