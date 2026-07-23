-- 평가위원장 통합의견 — 위원별 종합의견(Opinion)과 별개로 대상마다 1건. 추가 전용·멱등.
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "chairOpinion" TEXT;
