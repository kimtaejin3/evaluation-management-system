-- 배정 승인 상태 (분과 × 위원)
DO $$ BEGIN
  CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);

-- 백필(1회): 기존 배정은 이미 활동 중이므로 승인 처리
UPDATE "Assignment" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
