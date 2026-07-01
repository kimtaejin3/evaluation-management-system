-- Role: ADMIN → MASTER 이관 + SECRETARY 추가
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('MASTER', 'SECRETARY', 'EVALUATOR');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING (
  (CASE "role"::text WHEN 'ADMIN' THEN 'MASTER' ELSE "role"::text END)::"Role"
);
DROP TYPE "Role_old";

-- Project
CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- EvaluationSession FK 컬럼
ALTER TABLE "EvaluationSession" ADD COLUMN "projectId" TEXT;
ALTER TABLE "EvaluationSession" ADD COLUMN "secretaryId" TEXT;
ALTER TABLE "EvaluationSession" ADD CONSTRAINT "EvaluationSession_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvaluationSession" ADD CONSTRAINT "EvaluationSession_secretaryId_fkey"
  FOREIGN KEY ("secretaryId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 과제-간사 다대다(Prisma 암시적 m2m: A=Project, B=User)
CREATE TABLE "_ProjectSecretaries" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_ProjectSecretaries_AB_unique" ON "_ProjectSecretaries"("A", "B");
CREATE INDEX "_ProjectSecretaries_B_index" ON "_ProjectSecretaries"("B");
ALTER TABLE "_ProjectSecretaries" ADD CONSTRAINT "_ProjectSecretaries_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProjectSecretaries" ADD CONSTRAINT "_ProjectSecretaries_B_fkey"
  FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
