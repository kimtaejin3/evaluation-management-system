-- 분과 기준 만점(집계 환산 분모). 기본 100. 배점 합계와 별개(가점 대응).
ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "maxScore" INTEGER NOT NULL DEFAULT 100;
