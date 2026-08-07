-- 과제-평가위원 다대다(Prisma 암시적 m2m: A=Project, B=User)
-- 평가위원의 '참여 사업'을 분과 배정과 별개로 저장하기 위한 관계.
CREATE TABLE "_ProjectEvaluators" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_ProjectEvaluators_AB_unique" ON "_ProjectEvaluators"("A", "B");
CREATE INDEX "_ProjectEvaluators_B_index" ON "_ProjectEvaluators"("B");
ALTER TABLE "_ProjectEvaluators" ADD CONSTRAINT "_ProjectEvaluators_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProjectEvaluators" ADD CONSTRAINT "_ProjectEvaluators_B_fkey"
  FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 기존 데이터 백필: 이미 분과에 배정된 평가위원은 그 분과의 사업에 참여한 것으로 연결.
INSERT INTO "_ProjectEvaluators" ("A", "B")
SELECT DISTINCT s."projectId", a."userId"
FROM "Assignment" a
JOIN "EvaluationSession" s ON s."id" = a."sessionId"
JOIN "User" u ON u."id" = a."userId"
WHERE s."projectId" IS NOT NULL AND u."role" = 'EVALUATOR'
ON CONFLICT ("A", "B") DO NOTHING;
