-- 평가위원 배정 검토 워크플로: 간사 배정중(DRAFT) → 제출(SUBMITTED) → 관리자 승인(APPROVED)/반려(REJECTED)
DO $$ BEGIN
  CREATE TYPE "EvaluatorStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "evaluatorStatus" "EvaluatorStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "evaluatorRejectionReason" TEXT;

-- 기존 분과 백필: 승인된 배정이 있으면 승인 완료로 간주(운영 중 분과 보존)
UPDATE "EvaluationSession" s SET "evaluatorStatus" = 'APPROVED'
WHERE EXISTS (SELECT 1 FROM "Assignment" a WHERE a."sessionId" = s."id" AND a."status" = 'APPROVED');

-- 배정은 있으나 승인된 게 없으면 제출됨(관리자 검토 대기)으로
UPDATE "EvaluationSession" s SET "evaluatorStatus" = 'SUBMITTED'
WHERE s."evaluatorStatus" = 'DRAFT' AND EXISTS (SELECT 1 FROM "Assignment" a WHERE a."sessionId" = s."id");
