-- 평가대상 검토 상태(F10) + 배정 반려사유(F11)
DO $$ BEGIN
  CREATE TYPE "SubjectStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "status" "SubjectStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- 기존 평가대상은 이미 활동 중 → 승인 처리(1회)
UPDATE "Subject" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
