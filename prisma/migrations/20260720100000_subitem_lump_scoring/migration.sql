-- 세부항목 통합 배점(퉁 채점) 지원 — 추가 전용·멱등(공유 DB에서 구 코드와 호환)
-- CriterionSubitem.maxScore: null=지표별 모드(기존), 값=세부항목 단위 채점
ALTER TABLE "CriterionSubitem" ADD COLUMN IF NOT EXISTS "maxScore" DOUBLE PRECISION;

-- Score: 지표(criterionId) 또는 세부항목(subitemId) 중 하나에 붙는다
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "subitemId" TEXT;
ALTER TABLE "Score" ALTER COLUMN "criterionId" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Score" ADD CONSTRAINT "Score_subitemId_fkey"
    FOREIGN KEY ("subitemId") REFERENCES "CriterionSubitem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Score_evaluatorId_subjectId_subitemId_key"
  ON "Score"("evaluatorId", "subjectId", "subitemId");
