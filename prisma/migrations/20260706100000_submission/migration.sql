-- 제출/승인 상태 (위원 × 대상)
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "Submission" (
  "id"          TEXT NOT NULL,
  "sessionId"   TEXT NOT NULL,
  "evaluatorId" TEXT NOT NULL,
  "subjectId"   TEXT NOT NULL,
  "status"      "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "decidedAt"   TIMESTAMP(3),
  "decidedById" TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Submission_evaluatorId_subjectId_key" ON "Submission"("evaluatorId", "subjectId");
CREATE INDEX "Submission_sessionId_idx" ON "Submission"("sessionId");

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_sessionId_fkey" FOREIGN KEY ("sessionId")
  REFERENCES "EvaluationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
