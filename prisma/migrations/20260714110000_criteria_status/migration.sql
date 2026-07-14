-- 평가항목 검토 워크플로: 간사 입력중(DRAFT) → 제출(SUBMITTED) → 관리자 승인(APPROVED)/반려(REJECTED)
DO $$ BEGIN
  CREATE TYPE "CriteriaStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "criteriaStatus" "CriteriaStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "criteriaRejectionReason" TEXT;

-- 이미 마감(CLOSED)된 분과는 항목 구성이 끝난 상태 → 승인 처리(1회)
UPDATE "EvaluationSession" SET "criteriaStatus" = 'APPROVED' WHERE "status" = 'CLOSED' AND "criteriaStatus" = 'DRAFT';
