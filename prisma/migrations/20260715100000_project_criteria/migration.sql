-- 평가항목을 분과(EvaluationSession) 단위에서 과제(Project) 단위로 이동.
-- 관리자가 과제당 평가항목을 작성하고, 각 분과 간사는 '확인'만 한다.
-- 멱등: 재실행해도 안전하도록 IF NOT EXISTS / 예외 가드 사용.

-- 1) projectId 컬럼 추가 + sessionId는 레거시 호환용으로 nullable 전환
ALTER TABLE "Criterion" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "CriterionGroup" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Criterion" ALTER COLUMN "sessionId" DROP NOT NULL;
ALTER TABLE "CriterionGroup" ALTER COLUMN "sessionId" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CriterionGroup" ADD CONSTRAINT "CriterionGroup_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Criterion_projectId_idx" ON "Criterion"("projectId");
CREATE INDEX IF NOT EXISTS "CriterionGroup_projectId_idx" ON "CriterionGroup"("projectId");

-- 2) 간사 확인 시각 + 과제 기준 만점
ALTER TABLE "EvaluationSession" ADD COLUMN IF NOT EXISTS "criteriaAckAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "maxScore" INTEGER NOT NULL DEFAULT 100;

-- 3) 백필: 과제별로 평가항목(그룹)이 가장 많은 분과 1곳을 대표로 골라 그 항목들을 과제로 승격.
--    (다른 분과의 세션 단위 항목은 그대로 두되 새 UI에서는 보이지 않음)
WITH ranked AS (
  SELECT s."projectId" AS pid, s."id" AS sid,
         ROW_NUMBER() OVER (PARTITION BY s."projectId" ORDER BY count(g."id") DESC, s."createdAt" ASC) AS rn
  FROM "EvaluationSession" s
  JOIN "CriterionGroup" g ON g."sessionId" = s."id"
  WHERE s."projectId" IS NOT NULL
  GROUP BY s."projectId", s."id", s."createdAt"
)
UPDATE "CriterionGroup" cg SET "projectId" = r.pid
FROM ranked r
WHERE r.rn = 1 AND cg."sessionId" = r.sid AND cg."projectId" IS NULL;

WITH ranked AS (
  SELECT s."projectId" AS pid, s."id" AS sid,
         ROW_NUMBER() OVER (PARTITION BY s."projectId" ORDER BY count(g."id") DESC, s."createdAt" ASC) AS rn
  FROM "EvaluationSession" s
  JOIN "CriterionGroup" g ON g."sessionId" = s."id"
  WHERE s."projectId" IS NOT NULL
  GROUP BY s."projectId", s."id", s."createdAt"
)
UPDATE "Criterion" c SET "projectId" = r.pid
FROM ranked r
WHERE r.rn = 1 AND c."sessionId" = r.sid AND c."projectId" IS NULL;

-- 4) 과제 기준 만점을 대표 분과의 maxScore로 백필
WITH ranked AS (
  SELECT s."projectId" AS pid, s."id" AS sid, s."maxScore" AS ms,
         ROW_NUMBER() OVER (PARTITION BY s."projectId" ORDER BY count(g."id") DESC, s."createdAt" ASC) AS rn
  FROM "EvaluationSession" s
  JOIN "CriterionGroup" g ON g."sessionId" = s."id"
  WHERE s."projectId" IS NOT NULL
  GROUP BY s."projectId", s."id", s."createdAt", s."maxScore"
)
UPDATE "Project" p SET "maxScore" = r.ms
FROM ranked r
WHERE r.rn = 1 AND p."id" = r.pid;
