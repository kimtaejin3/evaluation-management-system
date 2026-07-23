-- 위원장 확인 — 위원장이 각 위원의 평가를 확인했는지. 간사·마스터 승인(status)과 별개. 추가 전용·멱등.
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "chairConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "chairConfirmedById" TEXT;
