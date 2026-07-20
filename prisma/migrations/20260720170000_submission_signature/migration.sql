-- 제출 서명(핸드사인) — 위원이 평가 제출 시 그린 서명(PNG data URL). 추가 전용·멱등.
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "signature" TEXT;
