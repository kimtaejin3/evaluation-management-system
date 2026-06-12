-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "url" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EvaluationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

