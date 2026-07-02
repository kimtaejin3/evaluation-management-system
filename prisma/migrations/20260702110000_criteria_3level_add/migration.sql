CREATE TABLE "CriterionGroup" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CriterionGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CriterionGroup_sessionId_idx" ON "CriterionGroup"("sessionId");
ALTER TABLE "CriterionGroup" ADD CONSTRAINT "CriterionGroup_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "EvaluationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CriterionSubitem" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CriterionSubitem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CriterionSubitem_groupId_idx" ON "CriterionSubitem"("groupId");
ALTER TABLE "CriterionSubitem" ADD CONSTRAINT "CriterionSubitem_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CriterionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Criterion" ADD COLUMN "subitemId" TEXT;
ALTER TABLE "Criterion" ALTER COLUMN "type" SET DEFAULT 'QUANTITATIVE';
CREATE INDEX "Criterion_subitemId_idx" ON "Criterion"("subitemId");
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_subitemId_fkey"
  FOREIGN KEY ("subitemId") REFERENCES "CriterionSubitem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
