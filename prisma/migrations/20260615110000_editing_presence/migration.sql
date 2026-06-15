-- CreateTable
CREATE TABLE "EditingPresence" (
    "evaluatorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditingPresence_pkey" PRIMARY KEY ("evaluatorId")
);
