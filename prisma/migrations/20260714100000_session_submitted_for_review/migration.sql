-- 집계결과 2단계 확정: 간사 '제출 완료' 시각. null이면 제출 전(제출중).
ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "submittedForReviewAt" TIMESTAMP(3);

-- 이미 마감(CLOSED)된 분과는 검토까지 끝난 상태 → 제출 완료로 소급 표시(1회)
UPDATE "EvaluationSession" SET "submittedForReviewAt" = "createdAt" WHERE "status" = 'CLOSED' AND "submittedForReviewAt" IS NULL;
