-- 평가항목(그룹)별 위원 의견 — (위원 × 대상 × 평가항목)당 1건. 추가 전용·멱등.
CREATE TABLE IF NOT EXISTS "GroupComment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GroupComment_evaluatorId_subjectId_groupId_key"
  ON "GroupComment"("evaluatorId", "subjectId", "groupId");
CREATE INDEX IF NOT EXISTS "GroupComment_sessionId_idx" ON "GroupComment"("sessionId");

DO $$ BEGIN
  ALTER TABLE "GroupComment" ADD CONSTRAINT "GroupComment_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "EvaluationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GroupComment" ADD CONSTRAINT "GroupComment_evaluatorId_fkey"
    FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GroupComment" ADD CONSTRAINT "GroupComment_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GroupComment" ADD CONSTRAINT "GroupComment_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "CriterionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
