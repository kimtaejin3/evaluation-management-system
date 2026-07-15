-- 과제에 수행 기간(시작일/종료일) 추가 — 평가일(dueDate)은 레거시로 보존.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

-- 백필: 기존 평가일(dueDate)이 있으면 종료일로 간주
UPDATE "Project" SET "endDate" = "dueDate" WHERE "endDate" IS NULL AND "dueDate" IS NOT NULL;
