-- CreateTable
CREATE TABLE "Opinion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opinion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opinion_evaluatorId_subjectId_key" ON "Opinion"("evaluatorId", "subjectId");

