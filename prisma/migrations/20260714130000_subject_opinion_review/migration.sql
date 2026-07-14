-- 평가 대상·평가 의견서 검토 워크플로: 간사 제출 → 관리자 승인/반려 (공통 ReviewStatus)
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "subjectReviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "subjectReviewRejectionReason" TEXT;
ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "opinionStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "opinionRejectionReason" TEXT;

-- 평가 대상 백필: 승인된 대상이 있으면 승인, 대상만 있으면 제출됨
UPDATE "EvaluationSession" s SET "subjectReviewStatus" = 'APPROVED'
WHERE EXISTS (SELECT 1 FROM "Subject" x WHERE x."sessionId" = s."id" AND x."status" = 'APPROVED');
UPDATE "EvaluationSession" s SET "subjectReviewStatus" = 'SUBMITTED'
WHERE s."subjectReviewStatus" = 'DRAFT' AND EXISTS (SELECT 1 FROM "Subject" x WHERE x."sessionId" = s."id");

-- 평가 의견서 백필: 마감 분과는 승인, 의견이 있으면 제출됨
UPDATE "EvaluationSession" s SET "opinionStatus" = 'APPROVED' WHERE s."status" = 'CLOSED';
UPDATE "EvaluationSession" s SET "opinionStatus" = 'SUBMITTED'
WHERE s."opinionStatus" = 'DRAFT' AND EXISTS (SELECT 1 FROM "Opinion" o WHERE o."sessionId" = s."id");
